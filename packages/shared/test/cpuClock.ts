// The clock benches in unit tests read: the CPU time this thread has spent, not the wall clock. On a shared machine
// the wall clock also counts the time other processes held the core: at a load of 16 on 4 cores the 128-bot tick
// (10-12 ms on CI) read 37 ms against its 30 ms threshold. The CPU time is the work itself, however busy the machine
// (a process-wide figure, GC threads included, where Node has no per-thread one).
export function cpuMs(): number {
  const u = typeof process.threadCpuUsage === 'function' ? process.threadCpuUsage() : process.cpuUsage();
  return (u.user + u.system) / 1000;
}
