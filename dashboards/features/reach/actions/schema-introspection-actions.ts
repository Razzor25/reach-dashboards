"use server";

import { reachGraphqlRequest } from "@/lib/api/reach-graphql-client";

export async function introspectTableFields(tableName: string) {
  const query = `
    query IntrospectTable {
      __type(name: "${tableName}") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  type IntrospectionResult = {
    __type: {
      name: string;
      fields: Array<{
        name: string;
        type: {
          name: string | null;
          kind: string;
          ofType: { name: string | null; kind: string } | null;
        };
      }>;
    } | null;
  };

  try {
    const data = await reachGraphqlRequest<IntrospectionResult>(query, {});
    const fields = data.__type?.fields.map((f) => {
      const typeName = f.type.ofType?.name || f.type.name || "unknown";
      const isNullable = f.type.kind === "SCALAR" || f.type.kind === "OBJECT";
      return {
        name: f.name,
        type: typeName,
        kind: f.type.kind,
        nullable: isNullable,
      };
    }) || [];
    
    return {
      success: true,
      tableName,
      fieldCount: fields.length,
      fields,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getAllTables() {
  const query = `
    query GetAllTables {
      __schema {
        queryType {
          fields {
            name
            description
          }
        }
      }
    }
  `;

  type IntrospectionResult = {
    __schema: {
      queryType: {
        fields: Array<{
          name: string;
          description: string | null;
        }>;
      };
    };
  };

  try {
    const data = await reachGraphqlRequest<IntrospectionResult>(query, {});
    const tables = data.__schema.queryType.fields
      .filter(f => !f.name.startsWith("__"))
      .filter(f => !f.name.endsWith("_aggregate") && !f.name.endsWith("_by_pk"))
      .map(f => f.name);
    
    return {
      success: true,
      tables,
      count: tables.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function testQomQuery() {
  // Try a simple query first to see what fields work
  const query = `
    query TestQom {
      qom_qom_interaction(limit: 1) {
        indv_id
        org_id
        interaction_type_id
        interaction_status_id
        creat_dttm
        chg_dttm
      }
    }
  `;

  try {
    const data = await reachGraphqlRequest<any>(query, {});
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function testInteractionTypeQuery() {
  const query = `
    query TestInteractionType {
      qom_interaction_type(limit: 5) {
        interaction_type_id
        creat_dttm
        chg_dttm
      }
    }
  `;

  try {
    const data = await reachGraphqlRequest<any>(query, {});
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getInteractionTypeFields() {
  return introspectTableFields("qom_interaction_type");
}

export async function testQomRefQuery() {
  // Maybe interaction type names are in qom_ref or qom_fdt_ref
  const query = `
    query TestQomRef {
      qom_ref(limit: 5, where: { ref_typ_cd: { _eq: "INTERACTION_TYPE" } }) {
        ref_id
        ref_cd
        ref_dspl
        ref_desc
        ref_typ_cd
      }
    }
  `;

  try {
    const data = await reachGraphqlRequest<any>(query, {});
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
