export const featureQuery = `
  MERGE (feature:Feature {id: $featureId})
  ON CREATE SET 
    feature.name=$featureName, 
    feature.isProduction=$isProduction, 
    feature.createdAt = datetime(), 
    feature.updatedAt = datetime()
  ON MATCH SET 
    feature.name=$featureName, 
    feature.isProduction=$isProduction, 
    feature.updatedAt = datetime()
  RETURN feature
`;

export const moduleQuery = `
    MERGE (module:Module {id: $moduleId})
    ON CREATE SET 
        module.name=$moduleName, 
        module.permissions = $permissions,
        module.isCore = $isCore,
        module.createdAt = datetime(), 
        module.updatedAt = datetime()
    ON MATCH SET 
        module.name = $moduleName,
        module.isCore = $isCore,
        module.updatedAt = CASE WHEN module.permissions <> $permissions THEN datetime() ELSE module.updatedAt END,
        module.permissions = CASE WHEN module.permissions <> $permissions THEN $permissions ELSE module.permissions END
    WITH module

    MATCH (feature:Feature) WHERE $featureId IS NOT NULL AND feature.id = $featureId
    WITH module, feature
    WHERE feature IS NOT NULL
    MERGE (module)-[:IN_FEATURE]->(feature)
`;

export const roleQuery = `
  MERGE (role:Role {id: $roleId})
  ON CREATE SET role.name=$roleName, role.isSelectable=$isSelectable, role.createdAt = datetime(), role.updatedAt = datetime()
  ON MATCH SET role.name=$roleName, role.isSelectable=$isSelectable, role.createdAt = datetime(), role.updatedAt = datetime()
  RETURN role
`;

export const permissionQuery = `
  MATCH (role:Role {id: $roleId})
  MATCH (module:Module {id: $moduleId})
  MERGE (role)-[permissions:HAS_PERMISSIONS]->(module)
  ON CREATE SET permissions.permissions = $permissions
  ON MATCH SET permissions.permissions = $permissions
`;
