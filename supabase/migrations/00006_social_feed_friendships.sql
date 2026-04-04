-- ============================================================================
--  Update social_feed RLS to use friendships table (bidirectional)
--  The original policy used the asymmetric `follows` table, but the app
--  now uses `friendships` for a mutual friend model.
-- ============================================================================

-- Drop the old select policy that uses follows
drop policy if exists "Users can see public/follower feed" on social_feed;

-- Create new select policy using friendships (bidirectional)
create policy "Users can see friend feed"
  on social_feed for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'followers'
      and exists (
        select 1 from friendships
        where friendships.status = 'accepted'
        and (
          (friendships.requester_id = auth.uid() and friendships.addressee_id = social_feed.user_id)
          or (friendships.addressee_id = auth.uid() and friendships.requester_id = social_feed.user_id)
        )
      )
    )
  );

-- ── Likes count trigger ────────────────────────────────────────────────
-- Keep social_feed.likes_count in sync with social_likes inserts/deletes

create or replace function update_likes_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update social_feed set likes_count = likes_count + 1 where id = NEW.feed_item_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update social_feed set likes_count = greatest(0, likes_count - 1) where id = OLD.feed_item_id;
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger social_likes_count_insert
  after insert on social_likes
  for each row execute function update_likes_count();

create trigger social_likes_count_delete
  after delete on social_likes
  for each row execute function update_likes_count();
