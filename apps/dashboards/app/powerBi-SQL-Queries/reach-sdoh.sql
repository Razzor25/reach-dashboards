---issues
-- DB:- qom (reach )
select msc.mbr_sdoh_cond_id,
timezone('us/central',msc.creat_dttm::timestamptz) date_of_search,
msc.indv_key_val,
CONCAT(ihp_user_tbl.lst_nm, ', ',ihp_user_tbl.fst_nm) staff,
case 
	when msc.sdoh_cond_sts_rsn_ref_id in (23106,23107,23108,23109) then timezone('us/central',msc.chg_dttm::timestamptz) 
end as resolve_date,
case 
	when  msc.sdoh_cond_sts_rsn_ref_id in (23108,23109) then 'Closed'
	else cmr.ref_dspl
end as issue_status,
case 
	when  msc.sdoh_cond_sts_rsn_ref_id = 23109 then substring(cmr2.ref_dspl from 0 for 15)
	else cmr2.ref_dspl
end as status_reason_category,
case 
	when msc.sdoh_cond_sts_rsn_ref_id = 23109 then cmr2.ref_dspl || ': ' || msc.sdoh_cond_sts_rsn_txt
	else cmr2.ref_dspl 
end as status_reason,
ihp_ref.ref_dspl issue_category
FROM mbr_sdoh_cond msc
left join qom_ref cmr on msc.sdoh_cond_sts_ref_id = cmr.ref_id --grabbing issue status
left join qom_ref cmr2 on msc.sdoh_cond_sts_rsn_ref_id = cmr2.ref_id  
LEFT JOIN ihp_ref ON ihp_ref.ref_id = msc.sdoh_cond_ref_id
JOIN ihp_user_tbl ON msc.creat_user_id = ihp_user_tbl.user_id
where msc.indv_key_val not ilike '-%'

---resources
-- db:- qom (reach )
SELECT sdoh_advct_srvc_id,
msc.mbr_sdoh_cond_id,
msc.mbr_sdoh_cond_desc,
CONCAT(ihp_user_tbl.lst_nm, ', ',ihp_user_tbl.fst_nm) staff, 
ihp_ref.ref_dspl issue_category, 
timezone('us/central', (jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB)) ->> 'date')::timestamp) as date_provided,
timezone('us/central', (jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB)) ->> 'chg_dttm')::timestamp) as date_accessed, --assuming that that the change is only for changing it to accessed
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB)) ->> 'resource_accessed' as resource_accessed,
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB))->'offices'-> 0 ->> 'city' as city,
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB))->'offices'-> 0 ->> 'postal' as postal,
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB)) ->> 'communication_type' AS com,
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB))->> 'program_name' AS progName,
jsonb_array_elements(CAST(sdoh_rsrce_dtl as JSONB))->> 'provider_name' AS provName,
msc.indv_key_val
FROM sdoh_advct_srvc sas
JOIN mbr_sdoh_cond msc ON msc.mbr_sdoh_cond_id = sas.mbr_sdoh_cond_id
JOIN ihp_user_tbl ON sas.creat_user_id = ihp_user_tbl.user_id
JOIN ihp_ref ON ihp_ref.ref_id = msc.sdoh_cond_ref_id
where msc.indv_key_val not ilike '-%'


---mbr_prov : db
--for org_nm


select indv_id,i.org_id,org_nm
from indv i 
left join indv_cli_org o on i.org_id=o.cli_org_id
join mbr_prov_org_configurations org on org.org_id=i.org_id
where indv_id>0 