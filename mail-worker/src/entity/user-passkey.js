import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const userPasskey = sqliteTable('user_passkey', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    name: text('name').notNull().default('Passkey'),
    signCount: integer('sign_count').notNull().default(0),
    createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`)
});

export default userPasskey;
