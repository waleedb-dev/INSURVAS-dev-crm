-- Exported via Supabase MCP (execute_sql)
-- Generated from pg_get_triggerdef() for schema: public

CREATE TRIGGER trg_commissions_updated_at BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_carrier_info_updated_at BEFORE UPDATE ON carrier_info FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_verification_items_updated_at BEFORE UPDATE ON verification_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_verification_progress_trigger AFTER INSERT OR DELETE OR UPDATE OF is_verified ON verification_items FOR EACH ROW EXECUTE FUNCTION update_verification_progress();
CREATE TRIGGER trg_carriers_updated_at BEFORE UPDATE ON carriers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_apply_routing BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION tickets_apply_default_assignee();
CREATE TRIGGER trg_tickets_before_update_enforce BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION tickets_before_update_enforce();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_imos_updated_at BEFORE UPDATE ON imos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ssn_duplicate_stage_rules_updated_at BEFORE UPDATE ON ssn_duplicate_stage_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assign_default_role BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION assign_default_role_to_user();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_verification_sessions_updated_at BEFORE UPDATE ON verification_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_set_submission_id_from_id BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION leads_set_submission_id_from_id();
CREATE TRIGGER trg_leads_sync_pipeline_stage_refs BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION leads_sync_pipeline_stage_refs();
CREATE TRIGGER trg_policies_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_call_results_updated_at BEFORE UPDATE ON call_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_center_thresholds_updated_at BEFORE UPDATE ON center_thresholds FOR EACH ROW EXECUTE FUNCTION update_center_thresholds_updated_at();
CREATE TRIGGER trg_app_fix_tasks_updated_at BEFORE UPDATE ON app_fix_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at_lead_queue_items BEFORE UPDATE ON lead_queue_items FOR EACH ROW EXECUTE FUNCTION set_updated_at_lead_queue_items();
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

