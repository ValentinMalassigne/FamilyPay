// Documents GraphQL partagés pour l'authentification (côté serveur et client).
//
// Centralisés ici pour éviter la duplication entre les Route Handlers
// (server-side, via fetch) et les composants client (via Apollo Client).

export const LOGIN_MUTATION = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        role
        firstName
        lastName
      }
    }
  }
`;

export const SIGNUP_MUTATION = /* GraphQL */ `
  mutation Signup(
    $firstName: String!
    $lastName: String!
    $email: String!
    $password: String!
    $familyName: String!
  ) {
    signup(
      firstName: $firstName
      lastName: $lastName
      email: $email
      password: $password
      familyName: $familyName
    ) {
      token
      user {
        id
        email
        role
        firstName
        lastName
      }
    }
  }
`;

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      email
      role
      firstName
      lastName
    }
  }
`;

// Type du profil utilisateur retourné par `me` / `login` / `signup`.
export type AppUser = {
  id: string;
  email: string;
  role: 'PARENT' | 'CHILD';
  firstName: string;
  lastName: string;
};
