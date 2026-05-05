-- Allow ticket participants to edit their own comment body (RLS had insert/delete only).
drop policy if exists ticket_comments_update_own on public.ticket_comments;
create policy ticket_comments_update_own
on public.ticket_comments
for update
to authenticated
using (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);
