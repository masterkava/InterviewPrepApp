export interface Skill {
  id: string;
  slug: string;
  name: string;
  category: string;
  weight: number;
}

export interface Role {
  id: string;
  slug: string;
  name: string;
  description: string;
  skills: Skill[];
}

export interface RolesListResponse {
  roles: Role[];
}

export interface RoleSkillsResponse {
  role_id: string;
  role_name: string;
  skills: Skill[];
}
