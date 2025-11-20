import { expirePoints } from './artlyService';

const scheduleDailyAtTwo = (task: () => void | Promise<void>) => {
  const runTask = async () => {
    try {
      await task();
    } catch (error) {
      console.error('Artly points expiry failed', error);
    }
  };

  const now = new Date();
  const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0, 0);
  let delay = nextRun.getTime() - now.getTime();
  if (delay < 0) {
    delay += 24 * 60 * 60 * 1000;
  }

  setTimeout(() => {
    runTask();
    setInterval(runTask, 24 * 60 * 60 * 1000);
  }, delay);
};

export const startCronJobs = () => {
  scheduleDailyAtTwo(async () => {
    const result = await expirePoints();
    console.log(`Artly points expiry ran, expired batches: ${result.expiredBatches}`);
  });
};
