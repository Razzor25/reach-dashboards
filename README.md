<img width="1417" height="646" alt="Screenshot 2026-05-11 at 2 41 07 AM" src="https://github.com/user-attachments/assets/9b79e646-6605-476e-94a2-65524dd830ed" />
<img width="1653" height="640" alt="Screenshot 2026-05-11 at 2 40 47 AM" src="https://github.com/user-attachments/assets/5913553f-a734-42c0-b73f-a8d69aa4c818" />


---interactions
--DB:- QOM ( REACH )
select org_id,case when qi.chg_dttm is not null then timezone('US/Central', qi.chg_dttm) 
else timezone('US/Central', qi.creat_dttm)
end as datetime,
interaction_name,qr.ref_dspl , count(*)
from qom_interaction qi 
join interaction_type it on qi.interaction_type_id=it.interaction_type_id 
join public.qom_ref qr on qr.ref_id = qi.interaction_status_id 
where indv_id > 0
and qi.interaction_status_id in (1000936,1000883,1002200) --scheduled, completed, attempted 
group by org_id,
interaction_name,qr.ref_dspl,qi.chg_dttm,qi.creat_dttm


---status
--DB:- QOM ( REACH )

select distinct dr.questnr_rspn_id,cs.org_id,
case when dr.chg_dttm is not null then timezone('US/Central', dr.chg_dttm) 
else timezone('US/Central', dr.creat_dttm)
end as datetime,
case 
	when dr.questnr_reesponse_val_txt in ('hipaa_verified','hipaa_verified_authorized_representative','hipaa_verified_via_warm_transfer') then 'Verified'
	when dr.questnr_reesponse_val_txt in ('declined_to_verify_hipaa', 'unable_to_verify_hipaa') then 'Failed'
	when dr.questnr_reesponse_val_txt = 'memberrepresentative_not_reached' then 'Not Reached'
end as hipaa_status,
dr.questnr_reesponse_val_txt status,
case 
	when (dr.questnr_reesponse_val_txt in ('declined_to_verify_hipaa', 'unable_to_verify_hipaa') 
		and (dr2.questnr_reesponse_val_txt is null or dr2.questnr_reesponse_val_txt = '')) then 'Reason Not Provided' 
	else dr2.questnr_reesponse_val_txt
end as reason 
from public.dw_questnr_rspn_dtl dr
join call_screening cs on cs.questnr_rspn_id::text=dr.questnr_rspn_id::text
join public.dw_questnr_rspn_dtl dr2 on dr.questnr_rspn_id=dr2.questnr_rspn_id
   and dr2.questnr_rspn_quest_txt in ('Summary')
where  dr.questnr_rspn_quest_txt ='Member HIPAA Verification'


---user details
--DB:- user-management-ocm
select distinct u.USER_ID,cli_org_id,fr.func_role_nm,
 u.USER_ID||'-'||func_role_nm user_func
from 
user_tbl u left join user_cli_func_role fr
                  ON        fr.user_id = u.user_id
where 
( fr.end_dt is  null or  fr.end_dt>current_date)




QOM ( REACH DB ) -

REACH_GRAPHQL_ENDPOINT=https://optumcare-api.optum.com/qom-read-fs/v1/graphql
REACH_GRAPHQL_ADMIN_SECRET=q0mr3adc0ns0les3cr3tk3y
