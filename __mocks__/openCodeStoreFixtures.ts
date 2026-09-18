import { DatabaseSync } from 'node:sqlite';

/*
 * OpenCode's own three tables. Six specs built this by hand and byte for byte,
 * so a change to the store's shape meant six edits and five chances to miss one.
 */
export const openCodeStore = (databasePath: string): DatabaseSync => {
  const database = new DatabaseSync(databasePath);

  database.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY, title TEXT, directory TEXT, parent_id TEXT,
      time_created INTEGER, time_updated INTEGER
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT,
      time_created INTEGER, data TEXT
    );
  `);

  return database;
};
