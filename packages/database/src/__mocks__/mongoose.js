// Mock for mongoose to avoid MongoDB/BSON issues

const MockObjectId = class MockObjectId {
  constructor(id) {
    this.id = id;
  }
  toString() {
    return this.id || "mock-object-id";
  }
};

const mockSchema = jest.fn(function (schemaDefinition, options) {
  // Store the schema definition for validation
  this.obj = schemaDefinition || {};
  this.options = options || {};
  this.Types = {
    ObjectId: MockObjectId,
    Mixed: jest.fn(),
  };
  return this;
});

// Add Types as a static property on mockSchema
mockSchema.Types = {
  ObjectId: MockObjectId,
  Mixed: jest.fn(),
};

// Helper to extract required fields and defaults from schema
function extractSchemaInfo(schemaDefinition) {
  const requiredFields = [];
  const defaults = {};
  const enums = {};
  const nestedSchemas = {};

  if (!schemaDefinition)
    return { requiredFields, defaults, enums, nestedSchemas };

  for (const [fieldName, fieldDef] of Object.entries(schemaDefinition)) {
    if (fieldDef && typeof fieldDef === "object") {
      // Check if field is required
      if (fieldDef.required === true) {
        requiredFields.push(fieldName);
      }

      // Check for default values
      if (fieldDef.default !== undefined) {
        defaults[fieldName] =
          typeof fieldDef.default === "function"
            ? fieldDef.default()
            : fieldDef.default;
      }

      // Check for enum values
      if (fieldDef.enum && Array.isArray(fieldDef.enum)) {
        enums[fieldName] = fieldDef.enum;
      }

      // Handle arrays with nested schemas
      if (
        fieldDef.type &&
        Array.isArray(fieldDef.type) &&
        fieldDef.type.length > 0
      ) {
        const arrayItemSchema = fieldDef.type[0];
        if (arrayItemSchema && arrayItemSchema.obj) {
          // This is a nested schema
          nestedSchemas[fieldName] = extractSchemaInfo(arrayItemSchema.obj);
        }
      }

      // Handle nested type definitions
      if (
        fieldDef.type &&
        typeof fieldDef.type === "object" &&
        !Array.isArray(fieldDef.type)
      ) {
        if (fieldDef.type.required === true) {
          requiredFields.push(fieldName);
        }
      }
    }
  }

  return { requiredFields, defaults, enums, nestedSchemas };
}

// Validate nested array items against their schema
function validateNestedArray(fieldName, items, nestedSchemaInfo) {
  if (!Array.isArray(items)) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Validate required fields in nested items
    for (const field of nestedSchemaInfo.requiredFields) {
      if (
        item[field] === undefined ||
        item[field] === null ||
        item[field] === ""
      ) {
        throw new Error(`${fieldName}[${i}].${field} is required`);
      }
    }

    // Validate enum fields in nested items
    for (const [field, allowedValues] of Object.entries(
      nestedSchemaInfo.enums,
    )) {
      if (item[field] !== undefined && !allowedValues.includes(item[field])) {
        throw new Error(
          `${fieldName}[${i}].${field} must be one of: ${allowedValues.join(", ")}`,
        );
      }
    }
  }
}

// Mock Model constructor that validates based on schema
function createMockModel(name, schema) {
  const schemaInfo = extractSchemaInfo(schema?.obj);

  return class MockModel {
    constructor(data = {}) {
      // Apply defaults first
      for (const [field, defaultValue] of Object.entries(schemaInfo.defaults)) {
        if (data[field] === undefined) {
          this[field] =
            typeof defaultValue === "object" && defaultValue !== null
              ? JSON.parse(JSON.stringify(defaultValue)) // Deep copy
              : defaultValue;
        }
      }

      // Copy all provided data to the instance
      Object.assign(this, data);

      // Validate required fields
      for (const field of schemaInfo.requiredFields) {
        if (
          this[field] === undefined ||
          this[field] === null ||
          this[field] === ""
        ) {
          throw new Error(`${field} is required`);
        }
      }

      // Validate enum fields
      for (const [field, allowedValues] of Object.entries(schemaInfo.enums)) {
        if (this[field] !== undefined && !allowedValues.includes(this[field])) {
          throw new Error(
            `${field} must be one of: ${allowedValues.join(", ")}`,
          );
        }
      }

      // Validate nested schemas
      for (const [field, nestedSchemaInfo] of Object.entries(
        schemaInfo.nestedSchemas,
      )) {
        if (this[field] !== undefined) {
          validateNestedArray(field, this[field], nestedSchemaInfo);
        }
      }

      // Convert string IDs to mock ObjectId
      if (typeof this.projectId === "string") {
        this.projectId = new MockObjectId(this.projectId);
      }

      // Handle projects array for User model
      if (this.projects && Array.isArray(this.projects)) {
        this.projects = this.projects.map((p) =>
          typeof p === "string" ? new MockObjectId(p) : p,
        );
      }
    }
  };
}

const mongoose = {
  connect: jest.fn().mockResolvedValue(undefined),
  connection: {
    readyState: 1,
  },
  models: {},
  model: jest.fn((name, schema) => {
    const Model = createMockModel(name, schema);
    mongoose.models[name] = Model;
    return Model;
  }),
  Schema: mockSchema,
  Types: {
    ObjectId: MockObjectId,
    Mixed: jest.fn(),
  },
};

module.exports = mongoose;
module.exports.default = mongoose;
