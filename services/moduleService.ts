import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import moduleRepository from "../repository/moduleRepository";
import { IModule } from "../models/moduleModel";
import { UpdateQuery, FilterQuery } from "mongoose";
import sectionRepository from "../repository/sectionRepository";
import { processBulkWriteErrors } from "../utils/csvUtils/csvUtils";
import { generatePagination } from "../utils/paginationUtils";

const moduleService = {
  getModule,
  getModules,
  createModule,
  updateModule,
  deleteModule,
  searchModule,
  bulkCreateModule,
  archiveModule,
};

export default moduleService;

async function getModule(id: string, params: any): Promise<IModule | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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

    return await moduleRepository.getModule(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getModules(
  params: any
): Promise<{ modules: IModule[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    dbParams.options.limit = params.limit || 10;
    dbParams.options.skip = (params.skip || 0) * dbParams.options.limit;
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
    const limit = params.limit || 10;

    const [modules, count] = await Promise.all([
      moduleRepository.getModules(dbParams),
      moduleRepository.getModulesCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { modules }),
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

async function createModule(
  data: Partial<IModule> & {
    sectionCode?: string;
  }
): Promise<any> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const { sectionCode, ...trimmedData } = trimAll(data);
    if (!sectionCode) {
      throw new Error("Section code is required to create a module");
    }

    const newSection = await moduleRepository.createModule({
      ...trimmedData,
    });
    await sectionRepository.updateSection(
      { code: sectionCode },
      {
        $push: {
          modules: newSection._id,
        },
      }
    );

    return { newSection, sectionCode };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateModule(data: Partial<IModule>): Promise<IModule | null> {
  if (!data._id) {
    throw new Error(config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.UPDATE);
  }

  const filter: FilterQuery<IModule> = { _id: data._id };
  const update: UpdateQuery<IModule> = { ...data };

  return await moduleRepository.updateModule(filter, update);
}

async function deleteModule(id: string): Promise<IModule | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.REMOVE);
  }

  try {
    const module = await moduleRepository.getModule(id, {});
    if (!module) {
      throw new Error("Module not found");
    }
    const section = await sectionRepository.searchSection({
      query: { modules: id },
      options: { limit: 1 },
    });

    const result = await moduleRepository.deleteModule(id);

    if (section && section.length > 0) {
      await sectionRepository.updateSection({ _id: section[0]._id }, { $pull: { modules: id } });
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchModule(params: any): Promise<any> {
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
    const [modules, count] = await Promise.all([
      moduleRepository.searchModule(dbParams),
      params.pagination || params.count
        ? moduleRepository.getModulesCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { modules, count } : modules;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { modules }),
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

async function bulkCreateModule(
  csvData: any[],
  organizationId: string,
  sectionCode: string
): Promise<{
  successCount: number;
  successList: Array<{
    title: string;
    organizationId: string;
  }>;
  errorCount: number;
  errorList: Array<{
    errorMessage: string;
    errorCode: number;
    row?: number;
  }>;
}> {
  if (!csvData || !Array.isArray(csvData)) {
    throw new Error("Invalid CSV data");
  }

  const successList: Array<{
    title: string;
    organizationId: string;
  }> = [];
  const errorList: Array<{
    errorMessage: string;
    errorCode: number;
    row?: number;
  }> = [];

  try {
    const moduleDataArray = csvData.map((row) => ({
      title: row.title,
      organizationId: organizationId,
    }));

    const createdModules = await moduleRepository.bulkCreateModule(moduleDataArray);
    if (createdModules && createdModules.length > 0) {
      await sectionRepository.updateSection(
        { code: sectionCode },
        { $push: { modules: { $each: createdModules.map((module: IModule) => module._id) } } }
      );
      createdModules.forEach((module: IModule) => {
        successList.push({
          title: module.title,
          organizationId: module.organizationId as string,
        });
      });
    }
  } catch (error: any) {
    if (error.name === "MongoBulkWriteError" && error.writeErrors) {
      errorList.push(...processBulkWriteErrors(error));
      if (error.insertedDocs && error.insertedDocs.length > 0) {
        await sectionRepository.updateSection(
          { code: sectionCode },
          { $push: { modules: { $each: error.insertedDocs.map((module: IModule) => module._id) } } }
        );

        error.insertedDocs.forEach((module: IModule) => {
          successList.push({
            title: module.title,
            organizationId: module.organizationId as string,
          });
        });
      }
    } else {
      errorList.push({
        errorMessage: error.message || "Unknown error occurred",
        errorCode: error.code || 500,
      });
    }
  }

  return {
    successCount: successList.length,
    successList,
    errorCount: errorList.length,
    errorList,
  };
}

async function archiveModule(id: string): Promise<IModule | null> {
  if (!id) {
    throw new Error("Invalid module ID");
  }

  try {
    const module = await moduleRepository.getModule(id, {});
    if (!module) {
      return null;
    }

    return await moduleRepository.archiveModule(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
