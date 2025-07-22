# Contact Messages Table Setup

This document explains how to set up the `contact_messages` table in Supabase for the contact form functionality.

## 📋 Table Structure

The `contact_messages` table stores all contact form submissions with the following structure:

```sql
CREATE TABLE public.contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(200),
    job_title VARCHAR(200),
    subject VARCHAR(200) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    message TEXT NOT NULL,
    newsletter_opt_in BOOLEAN DEFAULT false,
    marketing_opt_in BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Resolved', 'Closed')),
    assigned_to UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 Setup Instructions

### 1. Run the Migration

Use the provided PowerShell script to apply the migration:

```powershell
.\scripts\run-migration.ps1
```

Or manually run:

```bash
supabase db push
```

### 2. Verify the Table

Check that the table was created successfully:

```sql
-- Check table structure
\d contact_messages

-- Check if table exists
SELECT * FROM information_schema.tables
WHERE table_name = 'contact_messages';
```

### 3. Test the Contact Form

1. Navigate to `/contact` in your application
2. Fill out the contact form
3. Submit the form
4. Check the `contact_messages` table in Supabase to verify the data was saved

## 🔐 Security Features

### Row Level Security (RLS)

- **Public Insert**: Anyone can submit contact messages
- **Authenticated View**: Only authenticated users can view messages
- **Authenticated Update**: Only authenticated users can update message status

### Permissions

- `anon` role: Can insert new contact messages
- `authenticated` role: Can view, insert, and update contact messages

## 📊 Database Indexes

The following indexes are created for optimal performance:

- `idx_contact_messages_email` - For email lookups
- `idx_contact_messages_status` - For status filtering
- `idx_contact_messages_created_at` - For date-based queries
- `idx_contact_messages_priority` - For priority filtering

## 🔄 Automatic Features

### Updated At Trigger

The table includes an automatic trigger that updates the `updated_at` timestamp whenever a record is modified.

### Default Values

- `priority`: Defaults to 'Medium'
- `status`: Defaults to 'New'
- `newsletter_opt_in`: Defaults to false
- `marketing_opt_in`: Defaults to false

## 📝 Usage Examples

### Insert a Contact Message

```typescript
const { data, error } = await supabase.from('contact_messages').insert({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  subject: 'General Inquiry',
  message: 'Hello, I have a question...',
  priority: 'Medium',
})
```

### Query Contact Messages

```typescript
// Get all new messages
const { data } = await supabase
  .from('contact_messages')
  .select('*')
  .eq('status', 'New')
  .order('created_at', { ascending: false })

// Get messages by priority
const { data } = await supabase
  .from('contact_messages')
  .select('*')
  .eq('priority', 'High')
  .order('created_at', { ascending: false })
```

### Update Message Status

```typescript
const { data, error } = await supabase
  .from('contact_messages')
  .update({ status: 'In Progress' })
  .eq('id', messageId)
```

## 🛠️ Admin Interface

You can create an admin interface to manage contact messages:

1. **View all messages** with filtering by status, priority, date
2. **Update message status** (New → In Progress → Resolved)
3. **Assign messages** to team members
4. **Export messages** for reporting

## 🔧 Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure RLS policies are correctly configured
2. **Foreign Key Error**: Verify the `assigned_to` user exists in `auth.users`
3. **Validation Error**: Check that required fields are provided and values match constraints

### Debug Queries

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'contact_messages';

-- Check table permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'contact_messages';

-- Test insert permissions
INSERT INTO contact_messages (first_name, last_name, email, subject, message)
VALUES ('Test', 'User', 'test@example.com', 'Test Subject', 'Test message');
```

## 📈 Monitoring

Consider setting up monitoring for:

- **Message volume** - Track daily/weekly submission rates
- **Response times** - Monitor time from submission to status change
- **Error rates** - Track failed form submissions
- **Popular subjects** - Analyze common inquiry types

## 🔄 Future Enhancements

Potential improvements:

1. **Email notifications** when new messages arrive
2. **Auto-assignment** based on message type or workload
3. **Message templates** for common responses
4. **Integration** with customer support tools
5. **Analytics dashboard** for message metrics
