export interface Registration {
  id: string;
  event_id?: string;
  name: string;
  dob?: string;
  phone?: string;
  email?: string;
  gender?: string;
  affiliation?: string | null;
  college?: string | null;
  institute?: string | null;
  year_of_study?: string | null;
  yearOfStudy?: string | null;
  parish?: string | null;
  diocese?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TicketData {
  ticket: {
    tokenHash: string;
    ticketNumber: string;
    issuedAt: string;
  };
  participant: {
    name: string;
    parish: string;
    diocese: string;
    affiliation?: string;
    college?: string;
    institute?: string;
    yearOfStudy?: string;
    gender: string;
    phone: string;
    email: string;
    dob: string;
  };
  event: {
    name: string;
    location: string;
  };
}
