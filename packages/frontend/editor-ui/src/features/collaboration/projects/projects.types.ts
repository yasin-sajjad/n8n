import type { Scope, Role } from '@n8n/permissions';
import type { IUserResponse } from '@n8n/rest-api-client/api/users';

export const ProjectTypes = {
	Personal: 'personal',
	Team: 'team',
	Public: 'public',
} as const;

type ProjectTypeKeys = typeof ProjectTypes;

export type ProjectType = ProjectTypeKeys[keyof ProjectTypeKeys];
export type ProjectRelation = Pick<IUserResponse, 'id' | 'email' | 'firstName' | 'lastName'> & {
	role: string;
	starred: boolean;
};
export type ProjectMemberData = {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
	role: Role['slug'];
};
export type ProjectSharingData = {
	id: string;
	name: string | null;
	icon: { type: 'emoji'; value: string } | { type: 'icon'; value: string } | null;
	type: ProjectType;
	description?: string | null;
	createdAt: string;
	updatedAt: string;
};
export type Project = ProjectSharingData & {
	relations: ProjectRelation[];
	scopes: Scope[];
	starred: boolean;
};
export type ProjectListItem = ProjectSharingData & {
	role: Role['slug'];
	scopes?: Scope[];
	starred: boolean;
};
export type ProjectsCount = Record<ProjectType, number>;
