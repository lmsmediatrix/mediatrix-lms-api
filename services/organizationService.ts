import { config } from "../config/common";
import { IOrganization } from "../models/organizationModel";
import organizationRepository from "../repository/organizationRepository";
import cloudinaryService from "./cloudinaryService";
import { generatePagination } from "../utils/paginationUtils";

const organizationService = {
  getOrganization,
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  searchOrganization,
  organizationDashboard,
  archiveOrganization,
  generateCode,
  getOrganizationByCode,
};

export default organizationService;

async function getOrganization(id: string, params: any): Promise<IOrganization | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET);
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

    return await organizationRepository.getOrganization(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function organizationDashboard(id: string, params: any): Promise<IOrganization | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET);
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

    return await organizationRepository.getOrganization(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getOrganizations(params: any): Promise<any> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET_ALL);
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

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    if (params.limit) {
      dbParams.options.limit = params.limit || 10;
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
    const page = params.skip + 1;

    const [organizations, count] = await Promise.all([
      organizationRepository.getOrganizations(dbParams),
      organizationRepository.getOrganizationsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { organizations }),
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

async function createOrganization(
  data: Partial<IOrganization> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IOrganization> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.CREATE);
  }

  const existingOrg = await organizationRepository.findOrCreate({
    $or: [{ name: data.name }, { code: data.code }],
  });

  if (existingOrg) {
    const duplicateField = existingOrg.name === data.name ? "name" : "code";
    throw new Error(`Organization with this ${duplicateField} already exists`);
  }

  try {
    if (files) {
      data.branding = data.branding || {};
      if (files["branding.logo"]) {
        data.branding.logo = await cloudinaryService.uploadImage(
          files["branding.logo"][0],
          `${data.path}`
        );
      }
      if (files["branding.coverPhoto"]) {
        data.branding.coverPhoto = await cloudinaryService.uploadImage(
          files["branding.coverPhoto"][0],
          `${data.path}`
        );
      }
    }

    return await organizationRepository.createOrganization(data);
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = (Object.values(error.keyValue)[0] as string).replace(/["/]/g, "").trim();
      throw new Error(
        `Unable to create organization: The ${field} "${value}" is already taken. Please use a different ${field}.`
      );
    }
    throw error;
  }
}

async function updateOrganization(
  data: Partial<IOrganization> & { _id?: string; path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IOrganization | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.UPDATE);
  }

  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  try {
    const currentOrganization = await organizationService.getOrganization(data._id, {
      select: ["branding code"],
    });
    if (!currentOrganization) {
      throw new Error("Organization not found");
    }
    if (files?.["branding.logo"]) {
      if (currentOrganization?.branding?.logo) {
        const logoPublicId = extractPublicId(currentOrganization.branding.logo);
        if (logoPublicId) {
          await cloudinaryService.deleteImage(logoPublicId);
        }
      }
      data.branding = data.branding || {};
      data.branding.logo = await cloudinaryService.uploadImage(
        files["branding.logo"][0],
        `${data.path}`
      );
    }

    if (files?.["branding.coverPhoto"]) {
      if (currentOrganization?.branding?.coverPhoto) {
        const coverPhotoPublicId = extractPublicId(currentOrganization.branding.coverPhoto);
        if (coverPhotoPublicId) {
          await cloudinaryService.deleteImage(coverPhotoPublicId);
        }
      }
      data.branding = data.branding || {};
      data.branding.coverPhoto = await cloudinaryService.uploadImage(
        files["branding.coverPhoto"][0],
        `${data.path}`
      );
    }

    return await organizationRepository.updateOrganization(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteOrganization(id: string): Promise<IOrganization | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await organizationRepository.archiveOrganization(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchOrganization(params: any): Promise<any> {
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
    const [organizations, count] = await Promise.all([
      organizationRepository.searchOrganization(dbParams),
      params.pagination || params.count
        ? organizationRepository.getOrganizationsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { organizations, count } : organizations;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { organizations }),
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

async function archiveOrganization(id: string): Promise<IOrganization | null> {
  if (!id) {
    throw new Error("Invalid organization ID");
  }

  try {
    const organization = await organizationRepository.getOrganization(id, {});
    if (!organization) {
      return null;
    }

    return await organizationRepository.archiveOrganization(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function generateCode(name: string, code?: string): Promise<string> {
  if (code) {
    const existingOrg = await organizationRepository.findOrCreate({
      code: code,
    });
    if (existingOrg) {
      throw new Error(`Organization with code ${code} already exists`);
    }
    return code;
  }
  const words = name.split(" ");
  let initials;
  if (words.length === 1) {
    const word = words[0];
    initials = (word.charAt(0) + word.charAt(word.length - 1)).toUpperCase();
  } else {
    initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
  }
  const existingOrgWithInitials = await organizationRepository.findOrCreate({
    code: initials,
  });
  if (existingOrgWithInitials) {
    throw new Error(`Organization with code ${initials} already exists`);
  }

  return initials;
}

async function getOrganizationByCode(code: string, params: any): Promise<IOrganization | null> {
  if (!code) {
    throw new Error("Organization code parameter is missing."); // Or use a config message
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = (
        Array.isArray(params.populateArray) ? params.populateArray : [params.populateArray]
      ).map((item: any) => {
        if (typeof item === "string") {
          const [path, selectFields] = item.split(":");
          return selectFields ? { path, select: selectFields.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    } else {
      // If you want a specific default set of fields when no select param is provided for getOrganizationByCode
      // you can set it here. For example:
      // dbParams.options.select = "name code description admin users courses status branding isDeleted createdAt updatedAt";
      // For now, I'm leaving it to match getOrganization which also doesn't set a service-level default.
      // The repository will default to "_id" as per your recent change.
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }
    // Pass includeArchived from params if present, otherwise repository default (false) will apply
    if (params.includeArchived !== undefined) {
      dbParams.query.includeArchived = params.includeArchived;
    }

    return await organizationRepository.getOrganizationByCode(code, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
