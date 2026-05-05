-- Exported via Supabase MCP (execute_sql)
-- RLS enable statements and CREATE POLICY statements for schema: public

-- Enable RLS on tables that have policies defined
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_carrier_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_carriers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_fix_banking_updates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_fix_carrier_requirements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_fix_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.call_centers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.call_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.call_update_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.carrier_info ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.carrier_products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.center_thresholds ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_deal_flow ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disposition_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disposition_flow_nodes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disposition_flow_options ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disposition_flows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disposition_note_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.imos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_queue_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_queue_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_queue_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_guides ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ssn_duplicate_stage_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stage_disposition_map ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_followers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.upline_carrier_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_creation_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.verification_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.verification_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY disposition_events_insert ON public.disposition_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY disposition_events_select ON public.disposition_events AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY commissions_select_authenticated ON public.commissions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY stage_disposition_map_select_authenticated ON public.stage_disposition_map AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY carrier_info_delete_system_admin ON public.carrier_info AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY carrier_info_insert_system_admin ON public.carrier_info AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY carrier_info_select_system_admin ON public.carrier_info AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY carrier_info_update_system_admin ON public.carrier_info AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY verification_items_select_authenticated ON public.verification_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY verification_items_write_authenticated ON public.verification_items AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY carriers_delete_system_admin ON public.carriers AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY carriers_insert_system_admin ON public.carriers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY carriers_select_authenticated ON public.carriers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY carriers_update_system_admin ON public.carriers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY tickets_insert_publishers ON public.tickets AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((publisher_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'system_admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'call_center_admin'::text) AND (u.call_center_id IS NOT NULL) AND (((tickets.lead_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM leads l
          WHERE ((l.id = tickets.lead_id) AND (l.call_center_id = u.call_center_id))))) OR ((tickets.lead_id IS NULL) AND (u.call_center_id IS NOT NULL) AND (u.call_center_id = u.call_center_id))))))))));
CREATE POLICY tickets_select_participants ON public.tickets AS PERMISSIVE FOR SELECT TO authenticated USING (ticket_user_has_access(id, auth.uid()));
CREATE POLICY tickets_update_admin ON public.tickets AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (true);
CREATE POLICY tickets_update_assignee ON public.tickets AS PERMISSIVE FOR UPDATE TO authenticated USING ((assignee_id = auth.uid())) WITH CHECK (true);
CREATE POLICY imos_delete_system_admin ON public.imos AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY imos_insert_system_admin ON public.imos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY imos_select_system_admin ON public.imos AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY imos_update_system_admin ON public.imos AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY ssn_duplicate_stage_rules_delete_system_admin ON public.ssn_duplicate_stage_rules AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY ssn_duplicate_stage_rules_insert_system_admin ON public.ssn_duplicate_stage_rules AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY ssn_duplicate_stage_rules_select_authenticated ON public.ssn_duplicate_stage_rules AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY ssn_duplicate_stage_rules_update_system_admin ON public.ssn_duplicate_stage_rules AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY users_insert_admin_hr ON public.users AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_any_role(ARRAY['system_admin'::text, 'hr'::text]));
CREATE POLICY users_insert_own ON public.users AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
CREATE POLICY users_select_active_authenticated ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((status = 'active'::text));
CREATE POLICY users_select_admin_hr ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (has_any_role(ARRAY['system_admin'::text, 'hr'::text]));
CREATE POLICY users_select_call_center_admin_same_center ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role('call_center_admin'::text) AND (get_user_call_center_id(auth.uid()) IS NOT NULL) AND (get_user_call_center_id(auth.uid()) = call_center_id)));
CREATE POLICY users_select_own ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY users_select_publisher_manager ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('publisher_manager'::text));
CREATE POLICY users_select_system_admin_all ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY users_update_admin_hr ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING (has_any_role(ARRAY['system_admin'::text, 'hr'::text])) WITH CHECK (has_any_role(ARRAY['system_admin'::text, 'hr'::text]));
CREATE POLICY users_update_own ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY agencies_delete_system_admin ON public.agencies AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agencies_insert_system_admin ON public.agencies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agencies_select_system_admin ON public.agencies AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agencies_update_system_admin ON public.agencies AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agents_delete_system_admin ON public.agents AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agents_insert_system_admin ON public.agents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agents_select_system_admin ON public.agents AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agents_update_system_admin ON public.agents AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY roles_select_all_authenticated ON public.roles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY agent_carriers_delete_system_admin ON public.agent_carriers AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agent_carriers_insert_system_admin ON public.agent_carriers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agent_carriers_select_system_admin ON public.agent_carriers AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agent_carriers_update_system_admin ON public.agent_carriers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agent_states_delete_system_admin ON public.agent_states AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agent_states_insert_system_admin ON public.agent_states AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agent_states_select_system_admin ON public.agent_states AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agent_states_update_system_admin ON public.agent_states AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY states_modify_system_admin ON public.states AS PERMISSIVE FOR ALL TO public USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY states_select_all ON public.states AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY call_centers_delete_system_admin ON public.call_centers AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY call_centers_insert_system_admin ON public.call_centers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY call_centers_select_authenticated ON public.call_centers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY call_centers_select_call_center_admin ON public.call_centers AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('call_center_admin'::text));
CREATE POLICY call_centers_select_own_center ON public.call_centers AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.call_center_id = call_centers.id)))));
CREATE POLICY call_centers_select_system_admin ON public.call_centers AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY call_centers_update_call_center_admin ON public.call_centers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('call_center_admin'::text)) WITH CHECK (has_role('call_center_admin'::text));
CREATE POLICY call_centers_update_system_admin ON public.call_centers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('system_admin'::text)) WITH CHECK (has_role('system_admin'::text));
CREATE POLICY user_permissions_delete_admin_hr ON public.user_permissions AS PERMISSIVE FOR DELETE TO authenticated USING (has_any_role(ARRAY['system_admin'::text, 'hr'::text]));
CREATE POLICY user_permissions_insert_admin_hr ON public.user_permissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_any_role(ARRAY['system_admin'::text, 'hr'::text]));
CREATE POLICY user_permissions_select_admin_hr ON public.user_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND ((r.key = 'system_admin'::text) OR (r.key = 'hr'::text))))));
CREATE POLICY user_permissions_select_own_user ON public.user_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY user_permissions_write_system_admin ON public.user_permissions AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'system_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'system_admin'::text)))));
CREATE POLICY verification_sessions_select_authenticated ON public.verification_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY verification_sessions_write_authenticated ON public.verification_sessions AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY callback_requests_insert ON public.callback_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((requested_by = auth.uid()) OR (requested_by IS NULL)));
CREATE POLICY callback_requests_select ON public.callback_requests AS PERMISSIVE FOR SELECT TO authenticated USING (((requested_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'call_center_admin'::text])))))));
CREATE POLICY callback_requests_update ON public.callback_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'call_center_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'call_center_admin'::text]))))));
CREATE POLICY disposition_note_templates_select ON public.disposition_note_templates AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY disposition_flows_select ON public.disposition_flows AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY disposition_flow_nodes_select ON public.disposition_flow_nodes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY disposition_flow_options_select ON public.disposition_flow_options AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_select_all_authenticated ON public.permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY role_permissions_select_admin_hr ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND ((r.key = 'system_admin'::text) OR (r.key = 'hr'::text))))));
CREATE POLICY role_permissions_select_own_role ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role_id = role_permissions.role_id)))));
CREATE POLICY role_permissions_write_system_admin ON public.role_permissions AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'system_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = 'system_admin'::text)))));
CREATE POLICY lead_notes_delete ON public.lead_notes AS PERMISSIVE FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (users u
     JOIN roles r ON ((r.id = u.role_id)))
  WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'hr'::text, 'call_center_admin'::text])))))));
CREATE POLICY lead_notes_insert ON public.lead_notes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_notes.lead_id) AND ((l.submitted_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (users u
             JOIN roles r ON ((r.id = u.role_id)))
          WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'hr'::text, 'call_center_admin'::text, 'call_center_agent'::text, 'sales_admin'::text, 'sales_manager'::text, 'sales_agent_licensed'::text, 'sales_agent_unlicensed'::text]))))))))))));
CREATE POLICY lead_notes_select ON public.lead_notes AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_notes.lead_id) AND ((l.submitted_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (users u
             JOIN roles r ON ((r.id = u.role_id)))
          WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'hr'::text, 'call_center_admin'::text, 'call_center_agent'::text, 'sales_admin'::text, 'sales_manager'::text, 'sales_agent_licensed'::text, 'sales_agent_unlicensed'::text]))))))))));
CREATE POLICY lead_notes_update ON public.lead_notes AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_notes.lead_id) AND ((l.submitted_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (users u
             JOIN roles r ON ((r.id = u.role_id)))
          WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'hr'::text, 'call_center_admin'::text, 'call_center_agent'::text, 'sales_admin'::text, 'sales_manager'::text, 'sales_agent_licensed'::text, 'sales_agent_unlicensed'::text])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_notes.lead_id) AND ((l.submitted_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (users u
             JOIN roles r ON ((r.id = u.role_id)))
          WHERE ((u.id = auth.uid()) AND (r.key = ANY (ARRAY['system_admin'::text, 'hr'::text, 'call_center_admin'::text, 'call_center_agent'::text, 'sales_admin'::text, 'sales_manager'::text, 'sales_agent_licensed'::text, 'sales_agent_unlicensed'::text]))))))))));
CREATE POLICY agent_carrier_states_delete_system_admin ON public.agent_carrier_states AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('system_admin'::text));
CREATE POLICY agent_carrier_states_insert_system_admin ON public.agent_carrier_states AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('system_admin'::text));
CREATE POLICY agent_carrier_states_select_system_admin ON public.agent_carrier_states AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('system_admin'::text));

