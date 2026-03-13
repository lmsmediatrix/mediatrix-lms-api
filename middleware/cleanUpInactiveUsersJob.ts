import cron from "node-cron";
import userService from "../services/userService";
import { config } from "../config/common";

const cleanUpInactiveUsersJob = cron.schedule(
  config.CRON.CLEAN_UP.INACTIVE_USERS.TIME,
  async () => {
    try {
      await userService.cleanUpInactiveUsers();
    } catch (error) {
      console.error(error);
    }
  }
);

export const runCleanUpInactiveUsersJobImmediately = async () => {
  try {
    await userService.cleanUpInactiveUsers();
  } catch (error) {
    console.error(error);
  }
};

export default cleanUpInactiveUsersJob;
