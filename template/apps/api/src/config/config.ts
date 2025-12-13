import { baseConfig } from "@carlonicora/nestjs-neo4jsonapi";
import { JobName } from "src/config/enums/job.name";
import { QueueId } from "src/config/enums/queue.id";
import { ConfigInterface } from "src/config/interfaces/config.interface";

export default (): ConfigInterface => {
  return {
    ...baseConfig,
    chunkQueues: {
      queueIds: Object.values(QueueId),
    },
    contentTypes: {
      types: [],
    },
    jobNames: JobName,
  };
};
