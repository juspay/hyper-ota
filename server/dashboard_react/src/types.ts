export interface User {
  id: string;
  name: string;
  email: string;
  organisations: Organisation[];
}

export interface OrganisationUser {
  id: string;
  username: string;
  email: string;
  role: string[];
}

export interface Organisation {
  id: string;
  name: string;
  applications: Application[];
  users?: OrganisationUser[];
}

export interface Application {
  id: string;
  application: string;
  versions: string[];
}

export type HomeResponse =
  | { type: "CREATE_ORGANISATION"; name: string }
  | { type: "CREATE_APPLICATION"; organisation: string; name: string }
  | { type: "INVITE_USER"; organisation: string; email: string; role: string };
