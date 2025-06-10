# User Management Scripts

This directory contains TypeScript-based utility scripts for managing users in the Cloudless.gr application. These scripts provide a convenient way to create both administrative and regular users from the command line.

## Available Scripts

### 1. Create Admin User (`create-admin.ts`)

Creates a new user with administrative privileges.

```bash
npm run create:admin <email> <password> [name]
```

**Features:**

- Creates user with ADMIN role
- Automatically verifies email
- Securely hashes password using bcrypt
- Sets account as active
- Validates for existing users
- Provides detailed console output

**Example:**

```bash
npm run create:admin admin@cloudless.gr mysecurepassword "John Admin"
```

### 2. Create Regular User (`create-user.ts`)

Creates a new user with standard user privileges.

```bash
npm run create:user <email> <password> [name]
```

**Features:**

- Creates user with USER role
- Securely hashes password using bcrypt
- Sets account as active
- Validates for existing users
- Provides detailed console output

**Example:**

```bash
npm run create:user user@cloudless.gr mysecurepassword "John User"
```

## Security Features

- Password hashing using bcrypt (10 salt rounds)
- Input validation
- Duplicate email checking
- Secure database connection handling
- Proper error handling and logging

## Prerequisites

Make sure you have the following installed:

- Node.js and npm
- TypeScript
- @prisma/client
- bcrypt

## Installation

The scripts use dependencies that should already be installed in your project. If needed, you can install them manually:

```bash
npm install bcrypt @types/bcrypt --save-dev
```

## Error Handling

Both scripts include comprehensive error handling:

- Checks for existing users
- Validates input parameters
- Handles database connection errors
- Provides clear error messages

## Database Connection

The scripts automatically handle:

- Connection initialization
- Proper disconnection after completion
- Connection error handling

## Usage Notes

1. Always use strong passwords when creating users
2. Keep admin user creation limited to trusted environments
3. Store credentials securely
4. Don't commit sensitive information to version control

## Troubleshooting

If you encounter issues:

1. Ensure your database is running and accessible
2. Check that all required environment variables are set
3. Verify that Prisma schema is up to date
4. Check console output for detailed error messages

## Contributing

When modifying these scripts:

1. Maintain existing security measures
2. Add appropriate error handling
3. Update this documentation
4. Test thoroughly before deploying changes
