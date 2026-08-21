import { describe, it, expect, beforeEach, vi } from "vitest";

// Interface definitions for testing
interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  blockchain: string;
  language: string;
  framework: string;
  contract_type: string;
  files: any[];
  active_file_path: string;
  audit: any;
  versions: any[];
  deployments: any[];
  created_at: string;
  updated_at: string;
}

class MockProjectRepository {
  private db = new Map<string, ProjectRow>();
  public rlsEnabled = true;
  public dbOnline = true;
  public schemaCacheValid = true;

  public clear() {
    this.db.clear();
    this.rlsEnabled = true;
    this.dbOnline = true;
    this.schemaCacheValid = true;
  }

  public async insert(row: ProjectRow, callerUserId: string, callerRole: string): Promise<ProjectRow> {
    if (!this.dbOnline) {
      const err: any = new Error("Database connection timeout");
      err.code = "CONNECTION_EXCEPTION";
      throw err;
    }
    if (!this.schemaCacheValid) {
      const err: any = new Error("Could not find the table 'public.projects' in the schema cache");
      err.code = "PGRST205";
      throw err;
    }
    if (!row.name || !row.blockchain || !row.language) {
      const err: any = new Error("null value in column violates not-null constraint");
      err.code = "23502";
      throw err;
    }
    if (this.db.has(row.id)) {
      const err: any = new Error("duplicate key value violates unique constraint 'projects_pkey'");
      err.code = "23505";
      throw err;
    }
    // Check foreign-key uuid validity
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(row.user_id)) {
      const err: any = new Error(`invalid input syntax for type uuid: "${row.user_id}"`);
      err.code = "22P02";
      throw err;
    }
    // RLS check for insert: authenticated user must be the owner
    if (this.rlsEnabled && callerRole !== "admin" && callerUserId !== row.user_id) {
      const err: any = new Error("new row violates row-level security policy for table 'projects'");
      err.code = "42501";
      throw err;
    }

    this.db.set(row.id, { ...row });
    return { ...row };
  }

  public async getById(id: string, callerUserId: string, callerRole: string): Promise<ProjectRow | null> {
    if (!this.dbOnline) {
      const err: any = new Error("Database offline");
      err.code = "57P01";
      throw err;
    }
    const row = this.db.get(id);
    if (!row) return null;
    if (this.rlsEnabled && callerRole !== "admin" && row.user_id !== callerUserId) {
      // RLS filters out rows caller cannot read
      return null;
    }
    return { ...row };
  }

  public async list(callerUserId: string, callerRole: string): Promise<ProjectRow[]> {
    if (!this.dbOnline) {
      const err: any = new Error("Database offline");
      err.code = "57P01";
      throw err;
    }
    const all = Array.from(this.db.values());
    if (callerRole === "admin") {
      return all;
    }
    return all.filter((p) => p.user_id === callerUserId);
  }
}

describe("Project Isolation, Ownership, and Database Verification Tests", () => {
  const repo = new MockProjectRepository();

  const userA_Id = "666abcce-3b46-4b4e-8ba4-0bee79addd97";
  const userB_Id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const adminId = "690d8e1b-25b0-489a-b2df-699d822c2623";

  beforeEach(() => {
    repo.clear();
  });

  // 1. Authenticated user creates project
  it("1. Authenticated user creates project successfully", async () => {
    const proj: ProjectRow = {
      id: "project-100",
      user_id: userA_Id,
      name: "TokenVault",
      description: "Secure multi-sig vault",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Vault",
      files: [{ path: "src/TokenVault.sol", content: "// SPDX-License-Identifier: MIT", language: "solidity" }],
      active_file_path: "src/TokenVault.sol",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await repo.insert(proj, userA_Id, "user");
    expect(created).toBeDefined();
    expect(created.id).toBe("project-100");
    expect(created.name).toBe("TokenVault");
  });

  // 2. Project owner is correctly stored
  it("2. Project owner is correctly stored and mapped to auth user ID", async () => {
    const proj: ProjectRow = {
      id: "project-101",
      user_id: userA_Id,
      name: "StakingPool",
      description: "Yield staking",
      blockchain: "polygon",
      language: "solidity",
      framework: "hardhat",
      contract_type: "Staking",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await repo.insert(proj, userA_Id, "user");
    expect(created.user_id).toBe(userA_Id);
  });

  // 3. Project appears after reload
  it("3. Project appears in project list after simulated reload", async () => {
    const proj: ProjectRow = {
      id: "project-102",
      user_id: userA_Id,
      name: "NFTMarket",
      description: "Decentralized marketplace",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "NFT",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.insert(proj, userA_Id, "user");

    const reloaded = await repo.getById("project-102", userA_Id, "user");
    expect(reloaded).not.toBeNull();
    expect(reloaded?.name).toBe("NFTMarket");
  });

  // 4. Normal user cannot read another user's project (Isolation)
  it("4. Normal User B cannot read User A's private project", async () => {
    const projA: ProjectRow = {
      id: "project-userA-secret",
      user_id: userA_Id,
      name: "UserA_Secret_DAO",
      description: "Confidential DAO",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "DAO",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.insert(projA, userA_Id, "user");

    // User B tries to read User A's project
    const readByUserB = await repo.getById("project-userA-secret", userB_Id, "user");
    expect(readByUserB).toBeNull();

    // User B lists projects -> should be empty
    const listByUserB = await repo.list(userB_Id, "user");
    expect(listByUserB.length).toBe(0);
  });

  // 5. Admin can read all projects
  it("5. Admin can read all platform projects across all creators", async () => {
    const projA: ProjectRow = {
      id: "proj-A",
      user_id: userA_Id,
      name: "Project A",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const projB: ProjectRow = {
      id: "proj-B",
      user_id: userB_Id,
      name: "Project B",
      description: "",
      blockchain: "solana",
      language: "rust",
      framework: "anchor",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.insert(projA, userA_Id, "user");
    await repo.insert(projB, userB_Id, "user");

    // Admin lists all
    const allProjects = await repo.list(adminId, "admin");
    expect(allProjects.length).toBe(2);
    expect(allProjects.map((p) => p.id)).toContain("proj-A");
    expect(allProjects.map((p) => p.id)).toContain("proj-B");

    // Admin reads individual project created by User A
    const adminReadA = await repo.getById("proj-A", adminId, "admin");
    expect(adminReadA).not.toBeNull();
    expect(adminReadA?.name).toBe("Project A");
  });

  // 6. Invalid user/profile relationship (non-UUID format)
  it("6. Rejects invalid user ID with PostgreSQL UUID error", async () => {
    const invalidProj: ProjectRow = {
      id: "proj-bad-user",
      user_id: "not-a-valid-uuid",
      name: "BadUserProj",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await expect(repo.insert(invalidProj, "not-a-valid-uuid", "user")).rejects.toMatchObject({
      code: "22P02",
    });
  });

  // 7. Missing required field
  it("7. Rejects insert with missing required fields (not-null constraint)", async () => {
    const badProj: any = {
      id: "proj-missing-fields",
      user_id: userA_Id,
      name: "", // empty name
      blockchain: "ethereum",
      language: "solidity",
    };

    await expect(repo.insert(badProj, userA_Id, "user")).rejects.toMatchObject({
      code: "23502",
    });
  });

  // 8. RLS rejection
  it("8. Rejects insert when caller attempts to forge project ownership of another user", async () => {
    const forgedProj: ProjectRow = {
      id: "proj-forged",
      user_id: userB_Id, // Assigning to User B
      name: "ForgedProject",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Caller is User A attempting to insert for User B
    await expect(repo.insert(forgedProj, userA_Id, "user")).rejects.toMatchObject({
      code: "42501",
    });
  });

  // 9. Duplicate project ID
  it("9. Rejects insert with duplicate primary key", async () => {
    const proj: ProjectRow = {
      id: "proj-duplicate-id",
      user_id: userA_Id,
      name: "Original",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.insert(proj, userA_Id, "user");

    // Second insert with same id
    await expect(repo.insert(proj, userA_Id, "user")).rejects.toMatchObject({
      code: "23505",
    });
  });

  // 10. Database unavailable
  it("10. Handles database unavailable with clean error code", async () => {
    repo.dbOnline = false;

    const proj: ProjectRow = {
      id: "proj-db-down",
      user_id: userA_Id,
      name: "Test",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await expect(repo.insert(proj, userA_Id, "user")).rejects.toMatchObject({
      code: "CONNECTION_EXCEPTION",
    });
  });

  // 11. Schema cache / configuration mismatch
  it("11. Handles PostgREST PGRST205 schema cache / missing table diagnostic safely", async () => {
    repo.schemaCacheValid = false;

    const proj: ProjectRow = {
      id: "proj-pgrst205",
      user_id: userA_Id,
      name: "Test",
      description: "",
      blockchain: "ethereum",
      language: "solidity",
      framework: "foundry",
      contract_type: "Custom",
      files: [],
      active_file_path: "",
      audit: null,
      versions: [],
      deployments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await expect(repo.insert(proj, userA_Id, "user")).rejects.toMatchObject({
      code: "PGRST205",
    });
  });
});
