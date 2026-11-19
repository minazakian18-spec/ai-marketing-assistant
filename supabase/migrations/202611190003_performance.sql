-- Performance fixes from the Supabase Advisors (19 november 2026).
-- Same access rules as before; only how Postgres evaluates them changes.

-- 1. auth.uid() once per query instead of once per row: (select auth.uid()).
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists own_profile_write on public.profiles;
create policy own_profile_write on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists notification_read on public.notifications;
create policy notification_read on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and public.member_role(workspace_id) is not null);
drop policy if exists notification_update on public.notifications;
create policy notification_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()) and public.member_role(workspace_id) is not null)
  with check (recipient_id = (select auth.uid()) and public.member_role(workspace_id) is not null);

drop policy if exists agent_folders_own on public.agent_folders;
create policy agent_folders_own on public.agent_folders for select to authenticated
  using (user_id = (select auth.uid()) and public.member_role(workspace_id) is not null);
drop policy if exists agent_conversations_own on public.agent_conversations;
create policy agent_conversations_own on public.agent_conversations for select to authenticated
  using (user_id = (select auth.uid()) and public.member_role(workspace_id) is not null);
drop policy if exists agent_messages_own on public.agent_messages;
create policy agent_messages_own on public.agent_messages for select to authenticated
  using (user_id = (select auth.uid()) and public.member_role(workspace_id) is not null);

-- 2. notification_preferences: one SELECT policy; the write policy no longer
--    also covers SELECT (it was "for all").
drop policy if exists preferences_read on public.notification_preferences;
create policy preferences_read on public.notification_preferences for select to authenticated
  using (public.member_role(workspace_id) is not null and user_id = (select auth.uid()));
drop policy if exists preferences_write on public.notification_preferences;
drop policy if exists preferences_insert on public.notification_preferences;
drop policy if exists preferences_update on public.notification_preferences;
drop policy if exists preferences_delete on public.notification_preferences;
create policy preferences_insert on public.notification_preferences for insert to authenticated
  with check (public.member_role(workspace_id) is not null and user_id = (select auth.uid()));
create policy preferences_update on public.notification_preferences for update to authenticated
  using (public.member_role(workspace_id) is not null and user_id = (select auth.uid()))
  with check (public.member_role(workspace_id) is not null and user_id = (select auth.uid()));
create policy preferences_delete on public.notification_preferences for delete to authenticated
  using (public.member_role(workspace_id) is not null and user_id = (select auth.uid()));

-- 3. Indexes for foreign keys without a covering index (Advisor: 34).
create index if not exists account_application_events_actor_id_idx on public.account_application_events (actor_id);
create index if not exists account_applications_workspace_id_idx on public.account_applications (workspace_id);
create index if not exists account_applications_reviewed_by_idx on public.account_applications (reviewed_by);
create index if not exists agent_conversations_user_id_idx on public.agent_conversations (user_id);
create index if not exists agent_folders_user_id_idx on public.agent_folders (user_id);
create index if not exists agent_messages_user_id_idx on public.agent_messages (user_id);
create index if not exists audit_logs_workspace_id_idx on public.audit_logs (workspace_id);
create index if not exists automation_permissions_updated_by_idx on public.automation_permissions (updated_by);
create index if not exists email_campaign_runs_created_by_idx on public.email_campaign_runs (created_by);
create index if not exists email_deliveries_subscriber_id_idx on public.email_deliveries (subscriber_id);
create index if not exists email_deliveries_workspace_id_idx on public.email_deliveries (workspace_id);
create index if not exists inbox_conversations_assigned_user_id_idx on public.inbox_conversations (assigned_user_id);
create index if not exists inbox_messages_author_user_id_idx on public.inbox_messages (author_user_id);
create index if not exists inbox_webhook_events_workspace_id_idx on public.inbox_webhook_events (workspace_id);
create index if not exists instagram_publications_created_by_idx on public.instagram_publications (created_by);
create index if not exists integration_connections_connected_user_idx on public.integration_connections (connected_user);
create index if not exists library_albums_created_by_idx on public.library_albums (created_by);
create index if not exists library_albums_cover_file_id_idx on public.library_albums (cover_file_id);
create index if not exists library_files_created_by_idx on public.library_files (created_by);
create index if not exists newsletter_consent_events_workspace_id_idx on public.newsletter_consent_events (workspace_id);
create index if not exists newsletter_consent_events_form_id_idx on public.newsletter_consent_events (form_id);
create index if not exists newsletter_forms_created_by_idx on public.newsletter_forms (created_by);
create index if not exists newsletter_subscribers_form_id_idx on public.newsletter_subscribers (form_id);
create index if not exists notification_preferences_user_id_idx on public.notification_preferences (user_id);
create index if not exists notification_recipients_user_id_idx on public.notification_recipients (user_id);
create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id);
create index if not exists notifications_workspace_id_idx on public.notifications (workspace_id);
create index if not exists oauth_states_user_id_idx on public.oauth_states (user_id);
create index if not exists oauth_states_workspace_id_idx on public.oauth_states (workspace_id);
create index if not exists research_reports_requested_by_idx on public.research_reports (requested_by);
create index if not exists seo_scans_requested_by_idx on public.seo_scans (requested_by);
create index if not exists seo_sites_created_by_idx on public.seo_sites (created_by);
create index if not exists workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
-- Unused indexes are kept on purpose: the database is still small.
