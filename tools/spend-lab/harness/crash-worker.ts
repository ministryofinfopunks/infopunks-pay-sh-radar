import { openLab } from "./task-runner";
async function crash() {
  const lab = await openLab(
    process.argv[2],
    "crash-recovery",
    "actual-process-crash",
    "research-buyer",
  );
  const a = await lab.engine.decide(lab.job, "research-buyer");
  try {
    await lab.gate.execute(
      a.authorization,
      lab.job.candidates[0].operation!,
      "lab-controller",
      "lab-executor",
    );
  } catch {
    /* response lost after durable provider commit */
  }
  // Deliberately bypass cleanup to emulate controller death with an unresolved submission.
  process.exit(73);
}
crash().catch((error) => {
  console.error(error);
  process.exit(1);
});
