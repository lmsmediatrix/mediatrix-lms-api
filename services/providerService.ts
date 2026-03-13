import { trimAll } from "../helper/commonHelper";
import { IProvider } from "../models/providerModel";
import providerRepository from "../repository/providerRepository";
import { generatePagination } from "../utils/paginationUtils";
import { QueryCondition } from "../helper/types";

const providerService = {
  getProvider,
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  searchProvider,
};

export default providerService;

async function getProvider(id: string, params: any): Promise<IProvider | null> {
  if (!id) {
    throw new Error("Provider ID is required");
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

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
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

    return await providerRepository.getProvider(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getProviders(
  params: any
): Promise<{ providers: IProvider[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error("Invalid parameters for retrieving providers");
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

      const queryConditions: QueryCondition[] = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }

    if (params.limit) {
      dbParams.options.limit = params.limit;
    }

    if (params.skip) {
      dbParams.options.skip = params.skip * params.limit;
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

    if (params.query) {
      if (params.query.organizationId) {
        dbParams.query.organizationId = params.query.organizationId;
      }

      if (params.query.name) {
        dbParams.query.name = params.query.name;
      }

      if (params.query.contactEmail) {
        dbParams.query.contactEmail = params.query.contactEmail;
      }
    }

    const page = params.page || 1;
    const limit = params.limit || 10;

    const [providers, count] = await Promise.all([
      providerRepository.getProviders(dbParams),
      providerRepository.countProviders(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { providers }),
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

async function createProvider(data: Partial<IProvider>): Promise<IProvider> {
  if (!data) {
    throw new Error("Provider data is required");
  }

  try {
    const trimmedData = trimAll(data);
    const existingProvider = await providerRepository.searchProvider({
      query: { organizationId: trimmedData.organizationId },
      match: { code: trimmedData.code },
    });

    if (existingProvider && existingProvider.length > 0) {
      throw new Error("Provider code already exists");
    }

    return await providerRepository.createProvider(trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateProvider(data: Partial<IProvider>): Promise<IProvider | null> {
  const voucherId = data._id?.toString();
  if (!voucherId) {
    throw new Error("Provider ID is required");
  }

  try {
    const currentProvider = await providerService.getProvider(voucherId, {
      select: ["_id", "status"],
      query: { organizationId: data.organizationId },
    });

    if (!currentProvider) {
      throw new Error("Provider not found");
    }

    const trimmedData = trimAll(data);
    delete trimmedData._id;

    return await providerRepository.updateProvider(voucherId, trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteProvider(id: string): Promise<IProvider | null> {
  if (!id) {
    throw new Error("Provider ID is required");
  }

  try {
    const data = await providerRepository.getProvider(id, {
      options: { select: ["_id", "archive"].join(" ") },
    });

    if (!data) {
      throw new Error("Provider not found");
    }

    return await providerRepository.deleteProvider(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchProvider(params: any): Promise<any> {
  try {
    const dbParams = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
    };

    dbParams.query = params.query || {};

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const [providers, count] = await Promise.all([
      providerRepository.searchProvider(dbParams),
      params.pagination || params.count
        ? providerRepository.countProviders(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { providers, count } : providers;
    }

    const pagination = generatePagination(count, optionsObj.skip + 1, optionsObj.limit);
    return {
      ...(params.document && { providers }),
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
