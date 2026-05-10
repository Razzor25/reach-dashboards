/*Note :

Report level filter at powerbi : shows data only for "latest batch id"
*/


--main page

select cdo,batch_id,timezone('US/Central',hist_dttm) batch_date,concat(to_char(min(timezone('US/Central',hist_dttm)), 'YYYY-MM-DD'), ' ', '(', batch_id,')') date_id, count(*),
(select count(*) from mbr_measure_staging_hist m2 where m2.ingest_status ='FAILED' and dob is not null and m2.cdo=mms.cdo 
and timezone('US/Central',hist_dttm) >= timezone('US/Central', current_date) - interval '1 months' and m2.batch_id=mms.batch_id and m2.hist_dttm=mms.hist_dttm ) failed,
(select count(*) from mbr_measure_staging_hist m2 where m2.ingest_status ='SUCCESS' and dob is not null and m2.cdo=mms.cdo 
and timezone('US/Central',hist_dttm) >= timezone('US/Central', current_date) - interval '1 months' and m2.batch_id=mms.batch_id and m2.hist_dttm=mms.hist_dttm) success
from mbr_measure_staging_hist mms 
where timezone('US/Central',hist_dttm) >= timezone('US/Central', current_date) - interval '1 months' and dob is not null
group by cdo,batch_id,hist_dttm

--detailed information

select 1 as dummy ,cdo,hicn,hcontract,pbp,memberfirstnm,memberlastnm,dob,batch_id
from mbr_measure_staging_hist mmsh
where timezone('US/Central',hist_dttm) >= timezone('US/Central', current_date) - interval '1 months'
and mmsh.ingest_status ='FAILED'
and mmsh.dob is not null 