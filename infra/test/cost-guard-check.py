#!/usr/bin/env python3
"""A local rehearsal of the cost guard Lambda (infra/toshiro-trigger-multiplayer.yaml, StopFunction):
the inline code is taken from the template and run against stand-in AWS clients (no AWS, no boto3).
Run: python3 infra/test/cost-guard-check.py   (exit 0 = every case behaved)."""
import datetime, json, os, re, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
template = open(os.path.join(HERE, '..', 'toshiro-trigger-multiplayer.yaml')).read()
m = re.search(r"ZipFile: \|\n(.*?)\n      Tags:", template, re.S)
code = "\n".join(line[10:] for line in m.group(1).split("\n"))
assert len(code) <= 4096, f"inline Lambda code is {len(code)} characters (CloudFormation's limit: 4096)"

calls = []
state = {"spend": 0.0, "net": [0.1, 0.1, 0.1], "enabled": True}

class Client:
    def __init__(self, name): self.name = name
    def __getattr__(self, op):
        def call(**kw):
            calls.append((self.name, op))
            if op == "get_caller_identity": return {"Account": "123456789012"}
            if op == "describe_budget": return {"Budget": {"CalculatedSpend": {"ActualSpend": {"Amount": str(state["spend"])}}}}
            if op == "get_instance_metric_data":
                now = datetime.datetime.now(datetime.timezone.utc)
                return {"metricData": [{"timestamp": now - datetime.timedelta(hours=i), "sum": gb * 1e9} for i, gb in enumerate(reversed(state["net"]))]}
            if op == "get_distribution_config": return {"ETag": "E1", "DistributionConfig": {"Enabled": state["enabled"]}}
            if op == "update_distribution": state["enabled"] = kw["DistributionConfig"]["Enabled"]
            return {}
        return call

boto3 = types.ModuleType("boto3")
boto3.client = Client
sys.modules["boto3"] = boto3
os.environ.update(INSTANCE_NAME="hub", DISTRIBUTION_ID="E123", NOTIFY_TOPIC_ARN="arn:topic", BUDGET_NAME="cap", CAP_USD="30", NET_GB_PER_HOUR="6", NET_HOURS="3")
mod = types.ModuleType("guard")
exec(compile(code, "index.py", "exec"), mod.__dict__)

def case(name, event, expect_stop, **st):
    calls.clear(); state.update({"spend": 0.0, "net": [0.1, 0.1, 0.1], "enabled": True}); state.update(st)
    r = mod.handler(event, None)
    stopped = ("lightsail", "stop_instance") in calls
    ok = r.get("stopped", False) == expect_stop and stopped == expect_stop and (not expect_stop or ("sns", "publish") in calls) and (not expect_stop or state["enabled"] is False)
    print(("ok  " if ok else "FAIL"), name)
    return ok

sns = lambda msg, subject="AWS Budgets: cap": {"Records": [{"Sns": {"Subject": subject, "Message": msg}}]}
results = [
    case("budget alert by SNS stops the box and disables the CDN", sns("AWS Budget Notification: actual > 30 USD"), True),
    case("CloudFront alarm (ALARM) stops", sns(json.dumps({"AlarmName": "cdn-bytes", "NewStateValue": "ALARM"})), True),
    case("CloudFront alarm back to OK does nothing", sns(json.dumps({"AlarmName": "cdn-bytes", "NewStateValue": "OK"})), False),
    case("hourly: under the cap and quiet does nothing", {"source": "aws.events"}, False, spend=12.0),
    case("hourly: spend at the cap stops", {"source": "aws.events"}, True, spend=30.0),
    case("hourly: NetworkOut over the limit 3 hours running stops", {"source": "aws.events"}, True, net=[7, 8, 9]),
    case("hourly: one busy hour is not enough", {"source": "aws.events"}, False, net=[1, 1, 9]),
    case("dry run changes nothing", {"dryRun": True, "source": "aws.events"}, False, spend=99.0),
]
sys.exit(0 if all(results) else 1)
