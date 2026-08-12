import type { Profile, ProfileFieldKey, ProfileSection } from '@/types/profile';

/**
 * Profile schema + defaults for FormPilot AI.
 *
 * The form UI, validation, and the autofill matcher are all driven from the
 * single `PROFILE_SECTIONS` definition below, so adding a field is a one-line
 * change here rather than edits scattered across layers. Each descriptor's
 * `match` hints (aliases / autocomplete / input types / disqualifiers) are the
 * *data* the scoring matcher consumes — there is no per-field logic in the
 * engine, which is what lets custom fields share the exact same pathway.
 */

/**
 * Bumped whenever the persisted profile shape changes in a breaking way.
 * v2 introduced the extended built-in fields (education / professional / skills
 * / coding profiles) and the `customFields` array in the stored envelope.
 */
export const PROFILE_SCHEMA_VERSION = 2;

/**
 * The profile form, section by section. Each descriptor carries the semantic
 * hints (format, autocomplete) that keep detection website-agnostic later.
 */
export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'Your name as it should appear on forms.',
    fields: [
      {
        key: 'fullName',
        label: 'Full name',
        format: 'text',
        placeholder: 'Ada Lovelace',
        autoComplete: 'name',
        maxLength: 120,
        match: {
          aliases: ['full name', 'fullname', 'your name', 'legal name', 'contact name', 'name'],
          autocomplete: ['name'],
          // A bare "name" is only a person's name outside these contexts.
          disqualifiers: [
            'user',
            'username',
            'login',
            'company',
            'organization',
            'organisation',
            'file',
            'card',
            'account',
            'display',
            'nick',
            'nickname',
            'screen',
            'host',
            'domain',
            'event',
            'product',
          ],
        },
      },
      {
        key: 'firstName',
        label: 'First name',
        format: 'text',
        placeholder: 'Ada',
        autoComplete: 'given-name',
        maxLength: 60,
        match: {
          aliases: ['first name', 'firstname', 'given name', 'givenname', 'forename', 'fname'],
          autocomplete: ['given-name'],
        },
      },
      {
        key: 'lastName',
        label: 'Last name',
        format: 'text',
        placeholder: 'Lovelace',
        autoComplete: 'family-name',
        maxLength: 60,
        match: {
          aliases: ['last name', 'lastname', 'family name', 'familyname', 'surname', 'lname'],
          autocomplete: ['family-name'],
        },
      },
      {
        key: 'dateOfBirth',
        label: 'Date of birth',
        format: 'date',
        autoComplete: 'bday',
        helpText: 'Used only to fill date-of-birth fields.',
        match: {
          aliases: ['date of birth', 'dob', 'birth date', 'birthdate', 'birthday', 'bday'],
          autocomplete: ['bday'],
          inputTypes: ['date'],
        },
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'How forms can reach you.',
    fields: [
      {
        key: 'email',
        label: 'Email',
        format: 'email',
        placeholder: 'ada@example.com',
        autoComplete: 'email',
        maxLength: 254,
        match: {
          aliases: ['email', 'e mail', 'email address'],
          autocomplete: ['email'],
          inputTypes: ['email'],
        },
      },
      {
        key: 'phone',
        label: 'Phone',
        format: 'tel',
        placeholder: '+1 555 010 1234',
        autoComplete: 'tel',
        maxLength: 32,
        match: {
          aliases: [
            'phone',
            'phone number',
            'telephone',
            'mobile',
            'mobile number',
            'mobile no',
            'phone no',
            'contact number',
            'cell',
            'tel',
          ],
          autocomplete: ['tel', 'tel-national'],
          inputTypes: ['tel'],
        },
      },
    ],
  },
  {
    id: 'address',
    title: 'Address',
    description: 'Postal address details.',
    fields: [
      {
        key: 'addressLine1',
        label: 'Address line 1',
        format: 'text',
        placeholder: '12 Analytical Way',
        autoComplete: 'address-line1',
        maxLength: 120,
        match: {
          aliases: [
            'address line 1',
            'addressline1',
            'address 1',
            'street address',
            'street',
            'address',
          ],
          autocomplete: ['address-line1', 'street-address'],
        },
      },
      {
        key: 'addressLine2',
        label: 'Address line 2',
        format: 'text',
        placeholder: 'Apt, suite, unit (optional)',
        autoComplete: 'address-line2',
        maxLength: 120,
        match: {
          aliases: [
            'address line 2',
            'addressline2',
            'address 2',
            'apartment',
            'apt',
            'suite',
            'unit',
          ],
          autocomplete: ['address-line2'],
        },
      },
      {
        key: 'city',
        label: 'City',
        format: 'text',
        placeholder: 'London',
        autoComplete: 'address-level2',
        maxLength: 80,
        match: {
          aliases: ['city', 'town', 'suburb', 'locality'],
          autocomplete: ['address-level2'],
        },
      },
      {
        key: 'state',
        label: 'State / Province',
        format: 'text',
        placeholder: 'Greater London',
        autoComplete: 'address-level1',
        maxLength: 80,
        match: {
          aliases: ['state', 'province', 'region', 'county'],
          autocomplete: ['address-level1'],
        },
      },
      {
        key: 'postalCode',
        label: 'ZIP / PIN code',
        format: 'postal',
        placeholder: 'SW1A 1AA',
        autoComplete: 'postal-code',
        maxLength: 12,
        match: {
          aliases: [
            'postal code',
            'postalcode',
            'post code',
            'postcode',
            'zip',
            'zip code',
            'zipcode',
            'pin code',
            'pincode',
          ],
          autocomplete: ['postal-code'],
        },
      },
      {
        key: 'country',
        label: 'Country',
        format: 'text',
        placeholder: 'United Kingdom',
        autoComplete: 'country-name',
        maxLength: 80,
        match: {
          aliases: ['country', 'nation'],
          autocomplete: ['country', 'country-name'],
        },
      },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    description: 'Academic background used on application forms.',
    fields: [
      {
        key: 'college',
        label: 'College / University',
        format: 'text',
        placeholder: 'University of London',
        autoComplete: 'off',
        maxLength: 160,
        match: {
          aliases: [
            'college',
            'university',
            'institute',
            'institution',
            'school name',
            'college name',
            'university name',
            'alma mater',
          ],
        },
      },
      {
        key: 'degree',
        label: 'Degree',
        format: 'text',
        placeholder: 'B.Tech',
        autoComplete: 'off',
        maxLength: 120,
        match: {
          aliases: ['degree', 'qualification', 'course', 'program', 'programme', 'education level'],
        },
      },
      {
        key: 'branch',
        label: 'Branch / Major',
        format: 'text',
        placeholder: 'Computer Science',
        autoComplete: 'off',
        maxLength: 120,
        match: {
          aliases: [
            'branch',
            'major',
            'specialization',
            'specialisation',
            'stream',
            'discipline',
            'field of study',
          ],
        },
      },
      {
        key: 'graduationYear',
        label: 'Graduation year',
        format: 'text',
        placeholder: '2025',
        autoComplete: 'off',
        maxLength: 8,
        match: {
          aliases: [
            'graduation year',
            'year of graduation',
            'passing year',
            'year of passing',
            'passout year',
            'grad year',
            'batch',
          ],
        },
      },
      {
        key: 'cgpa',
        label: 'CGPA',
        format: 'text',
        placeholder: '8.7',
        autoComplete: 'off',
        maxLength: 16,
        match: {
          aliases: [
            'cgpa',
            'gpa',
            'grade point average',
            'cumulative gpa',
            'cumulative grade point average',
            'cpi',
          ],
        },
      },
      {
        key: 'percentage10',
        label: '10th percentage',
        format: 'text',
        placeholder: '92%',
        autoComplete: 'off',
        maxLength: 16,
        match: {
          aliases: [
            '10th percentage',
            'tenth percentage',
            'class 10 percentage',
            '10th marks',
            'ssc percentage',
            'matriculation percentage',
            'x percentage',
          ],
        },
      },
      {
        key: 'percentage12',
        label: '12th percentage',
        format: 'text',
        placeholder: '89%',
        autoComplete: 'off',
        maxLength: 16,
        match: {
          aliases: [
            '12th percentage',
            'twelfth percentage',
            'class 12 percentage',
            '12th marks',
            'hsc percentage',
            'intermediate percentage',
            'xii percentage',
          ],
        },
      },
    ],
  },
  {
    id: 'professional',
    title: 'Professional',
    description: 'Current work details.',
    fields: [
      {
        key: 'jobTitle',
        label: 'Job title',
        format: 'text',
        placeholder: 'Software Engineer',
        autoComplete: 'organization-title',
        maxLength: 120,
        match: {
          aliases: [
            'job title',
            'designation',
            'current designation',
            'current title',
            'position',
            'current position',
            'job role',
          ],
          autocomplete: ['organization-title'],
        },
      },
      {
        key: 'company',
        label: 'Company',
        format: 'text',
        placeholder: 'Acme Corp',
        autoComplete: 'organization',
        maxLength: 120,
        match: {
          aliases: [
            'company',
            'company name',
            'employer',
            'current company',
            'current employer',
            'current organization',
            'organization name',
          ],
          autocomplete: ['organization'],
        },
      },
      {
        key: 'yearsOfExperience',
        label: 'Years of experience',
        format: 'text',
        placeholder: '3',
        autoComplete: 'off',
        maxLength: 16,
        match: {
          aliases: [
            'years of experience',
            'total experience',
            'work experience',
            'years experience',
            'experience in years',
            'total work experience',
            'yrs of experience',
            'experience',
          ],
        },
      },
      {
        key: 'projects',
        label: 'Projects',
        format: 'multiline',
        placeholder: 'Inventory API — Node.js service handling 2k req/s',
        autoComplete: 'off',
        maxLength: 2000,
        helpText: 'One per line; used to fill "Projects" style fields.',
        match: {
          aliases: [
            'projects',
            'project',
            'key projects',
            'notable projects',
            'personal projects',
            'academic projects',
            'relevant projects',
            'project details',
            'projects undertaken',
          ],
        },
      },
      {
        key: 'certifications',
        label: 'Certifications',
        format: 'multiline',
        placeholder: 'AWS Certified Solutions Architect (2024)',
        autoComplete: 'off',
        maxLength: 1000,
        helpText: 'One per line; used to fill "Certifications" style fields.',
        match: {
          aliases: [
            'certifications',
            'certification',
            'certificates',
            'certificate',
            'professional certifications',
            'licenses and certifications',
            'certs',
          ],
        },
      },
    ],
  },
  {
    id: 'skills',
    title: 'Skills',
    description: 'A comma-separated list of your skills.',
    fields: [
      {
        key: 'skills',
        label: 'Skills',
        format: 'multiline',
        placeholder: 'React, TypeScript, Node.js, SQL',
        autoComplete: 'off',
        maxLength: 1000,
        helpText: 'Comma-separated; used to fill "Skills" style fields.',
        match: {
          aliases: [
            'skills',
            'technical skills',
            'programming skills',
            'key skills',
            'core skills',
            'skill set',
            'skillset',
            'relevant skills',
            'primary skills',
            'areas of expertise',
          ],
        },
      },
    ],
  },
  {
    id: 'links',
    title: 'Links',
    description: 'Portfolio, professional and coding profiles.',
    fields: [
      {
        key: 'website',
        label: 'Portfolio / Website',
        format: 'url',
        placeholder: 'https://example.com',
        autoComplete: 'url',
        maxLength: 200,
        match: {
          aliases: ['website', 'web site', 'portfolio', 'homepage', 'personal site', 'blog', 'url'],
          // Owns the generic `url` input type so a bare URL field falls here.
          inputTypes: ['url'],
        },
      },
      {
        key: 'linkedin',
        label: 'LinkedIn',
        format: 'url',
        placeholder: 'https://linkedin.com/in/username',
        autoComplete: 'url',
        maxLength: 200,
        match: {
          aliases: ['linkedin', 'linked in'],
        },
      },
      {
        key: 'github',
        label: 'GitHub',
        format: 'url',
        placeholder: 'https://github.com/username',
        autoComplete: 'url',
        maxLength: 200,
        match: {
          aliases: ['github', 'git hub'],
        },
      },
      {
        key: 'leetcode',
        label: 'LeetCode',
        format: 'url',
        placeholder: 'https://leetcode.com/username',
        autoComplete: 'url',
        maxLength: 200,
        match: {
          aliases: ['leetcode', 'leet code'],
        },
      },
      {
        key: 'hackerrank',
        label: 'HackerRank',
        format: 'url',
        placeholder: 'https://hackerrank.com/username',
        autoComplete: 'url',
        maxLength: 200,
        match: {
          aliases: ['hackerrank', 'hacker rank'],
        },
      },
    ],
  },
];

/** Flattened list of every field descriptor across all sections. */
export const FIELD_DESCRIPTORS = PROFILE_SECTIONS.flatMap((section) => section.fields);

/** Ordered list of every known field key. Safe to iterate for I/O + validation. */
export const PROFILE_FIELD_KEYS: readonly ProfileFieldKey[] = FIELD_DESCRIPTORS.map(
  (descriptor) => descriptor.key,
);

/**
 * A fresh, fully-populated empty profile. Written as an explicit literal so the
 * compiler guarantees every {@link ProfileFieldKey} is present — the canonical
 * "default state" used before anything is saved and after a reset.
 */
export function createEmptyProfile(): Profile {
  return {
    fullName: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    college: '',
    degree: '',
    branch: '',
    graduationYear: '',
    cgpa: '',
    percentage10: '',
    percentage12: '',
    jobTitle: '',
    company: '',
    yearsOfExperience: '',
    projects: '',
    certifications: '',
    skills: '',
    website: '',
    linkedin: '',
    github: '',
    leetcode: '',
    hackerrank: '',
  };
}

/** True when a profile holds no user-entered values (the empty/default state). */
export function isProfileEmpty(profile: Profile): boolean {
  return PROFILE_FIELD_KEYS.every((key) => profile[key].trim() === '');
}
