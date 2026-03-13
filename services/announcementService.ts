import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import announcementRepository from "../repository/announcementRepository";
import { IAnnouncement } from "../models/announcementModel";
import sectionRepository from "../repository/sectionRepository";
import { generatePagination } from "../utils/paginationUtils";

const announcementService = {
  getAnnouncement,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  searchAnnouncement,
  archiveAnnouncement,
};

export default announcementService;

async function getAnnouncement(id: string, params: any): Promise<IAnnouncement | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await announcementRepository.getAnnouncement(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getAnnouncements(
  params: any
): Promise<{ announcements: IAnnouncement[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (
      params.queryArray &&
      params.queryArray.length > 0 &&
      params.queryArrayType &&
      params.queryArrayType.length > 0
    ) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition: any) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    if (params.limit) {
      dbParams.options.limit = params.limit;
    }
    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    const page = params.page || 1;

    const [announcements, count] = await Promise.all([
      announcementRepository.getAnnouncements(dbParams),
      announcementRepository.announcementsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { announcements }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function createAnnouncement(data: Partial<IAnnouncement>, user: any): Promise<IAnnouncement> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = trimAll(data);

    const newAnnouncement = await announcementRepository.createAnnouncement({
      ...trimmedData,
      author: user.id,
    });

    if (trimmedData.scope === "section") {
      await sectionRepository.updateSection(
        { _id: newAnnouncement.scopeId },
        {
          $push: {
            announcements: newAnnouncement._id,
          },
        }
      );
    }

    return newAnnouncement;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateAnnouncement(data: Partial<IAnnouncement>): Promise<IAnnouncement | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  try {
    return await announcementRepository.updateAnnouncement(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteAnnouncement(id: string): Promise<IAnnouncement | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await announcementRepository.archiveAnnouncement(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchAnnouncement(params: any): Promise<any> {
  try {
    const dbParams: {
      query: any;
      populateArray: any[];
      options: any;
      lean: boolean;
      match: any;
      includeArchived?: boolean | string;
      archivedOnly?: boolean;
      pagination?: boolean;
      document?: boolean;
    } = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: params.includeArchived,
      archivedOnly: params.archivedOnly,
    };

    dbParams.query = params.query || {};

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const skip = params.skip || 0;
    const [announcements, count] = await Promise.all([
      announcementRepository.searchAnnouncement(dbParams),
      params.pagination || params.count
        ? announcementRepository.announcementsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { announcements, count } : announcements;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { announcements }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function archiveAnnouncement(id: string): Promise<IAnnouncement | null> {
  if (!id) {
    throw new Error("Invalid announcement ID");
  }

  try {
    const announcement = await announcementRepository.getAnnouncement(id, {});
    if (!announcement) {
      return null;
    }

    return await announcementRepository.archiveAnnouncement(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
