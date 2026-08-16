-- Add a username column, backfilled from each account's email local part
-- (everything before the @, lowercased). If two accounts would collide on
-- the same username, a number is appended to keep it unique (e.g. bob, bob2).

-- Add as nullable first so it can be backfilled.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill usernames from emails.
DO $$
DECLARE
  u RECORD;
  base TEXT;
  candidate TEXT;
  i INT;
BEGIN
  FOR u IN SELECT id, email FROM "User" LOOP
    base := lower(split_part(u.email, '@', 1));
    candidate := base;
    i := 1;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE username = candidate AND id <> u.id) LOOP
      i := i + 1;
      candidate := base || i::text;
    END LOOP;
    UPDATE "User" SET username = candidate WHERE id = u.id;
  END LOOP;
END $$;

-- Enforce non-null and uniqueness now that every row has a username.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
