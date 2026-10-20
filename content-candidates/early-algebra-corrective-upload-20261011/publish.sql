begin;
create temporary table corrective_publication (
 revision uuid, source_revision uuid, song_asset_id text, chart_bucket text, chart_path text, chart_sha256 text,
 sidecar_bucket text, sidecar_path text, sidecar_sha256 text, equation_count integer, encounter_count integer, target_count integer
) on commit drop;
insert into corrective_publication values
('208461a1-76d7-40cf-bdb3-22a1356ca314'::uuid,'1e74d18a-dc7c-4758-8dd5-9a9a39fb0d4a'::uuid,'jazzmaybach','Charts','dev/Early_Algebra/revisions/208461a1-76d7-40cf-bdb3-22a1356ca314/Melika.chart','7a7b59a4aee0b99cfa4ff23b637c5375e1222b50c3a9fc79872b96e42c734ff0','SidecarJsons','dev/Early_Algebra/revisions/208461a1-76d7-40cf-bdb3-22a1356ca314/Melika.encounters.json','21d7ae0895e651029eaf67a0e313f1bbb61af04b1ac7d2c1cdcacbab077997e6',8,24,24),
('e1e54c78-8abc-42c3-8e1d-29246bb72671'::uuid,'690510be-f81d-485c-940d-d70b0e3bb33c'::uuid,'garden','Charts','dev/Early_Algebra/revisions/e1e54c78-8abc-42c3-8e1d-29246bb72671/Garden.chart','b514138b1677e5ee3833dcf642507208dcfb01ad994c8ced6e725222f55cc44e','SidecarJsons','dev/Early_Algebra/revisions/e1e54c78-8abc-42c3-8e1d-29246bb72671/Garden.encounters.json','7f45219ffb553bf7d167eba04cc86b6aac0736684bf2e99dd0f78887f517e675',9,32,32),
('0c1d4800-db96-4a19-b9ad-08b215296320'::uuid,'74ab8e9f-6cda-4f39-8338-1a41635184d0'::uuid,'justbecause','Charts','dev/Early_Algebra/revisions/0c1d4800-db96-4a19-b9ad-08b215296320/Oogie - just because.chart','4ee19c04398ec26098a2e30b5cbe3ada707bbcc77865822dd3f4e18e6f905047','SidecarJsons','dev/Early_Algebra/revisions/0c1d4800-db96-4a19-b9ad-08b215296320/Oogie - just because.encounters.json','2c502347bd2e05f51757e8944964d61e7197bbda62000c98f386a901717a2c1e',9,31,31),
('a534ce17-ff58-4bcd-988e-96a818e7c1b8'::uuid,'9e5302e3-357d-4969-9b43-a3bedfe460dc'::uuid,'oneone','Charts','dev/Early_Algebra/revisions/a534ce17-ff58-4bcd-988e-96a818e7c1b8/one one.chart','bd8d2bca59aaff433a1d86781607193c71eb2f81bc859f4719d0523a3a68ae82','SidecarJsons','dev/Early_Algebra/revisions/a534ce17-ff58-4bcd-988e-96a818e7c1b8/one one.encounters.json','524082f8461656a70828e224dad39bac175bf90c81f9ca8cdd410570a82bca8e',9,32,32),
('3d57e0ca-bfd4-40d3-9825-94a9f65bec92'::uuid,'a721c3ab-28aa-413c-afc5-bad3c83a10a6'::uuid,'geminiqueen','Charts','dev/Early_Algebra/revisions/3d57e0ca-bfd4-40d3-9825-94a9f65bec92/GEMINI QUEEN.chart','6641425fae5390246e5ea4a3253b609e3206344ce31a44f8c8d7a6383a220e59','SidecarJsons','dev/Early_Algebra/revisions/3d57e0ca-bfd4-40d3-9825-94a9f65bec92/GEMINI QUEEN.encounters.json','4e06e2edf2a7f82b67044ae2543a8d807bcdf4a3e14c6fe30188c52f2c9eb4ca',8,38,38),
('e9456f76-bd52-451f-85f3-ebbed71cd792'::uuid,'e3ad2a28-a4c5-4028-adbb-5bc09fef179f'::uuid,'seven','Charts','dev/Early_Algebra/revisions/e9456f76-bd52-451f-85f3-ebbed71cd792/EF - seven.chart','8611e13d17f720c706291a3167fc3a671abf5df705c509e6b017083a155b81ba','SidecarJsons','dev/Early_Algebra/revisions/e9456f76-bd52-451f-85f3-ebbed71cd792/EF - seven.encounters.json','9dbffe6fad4ef8a9e50bad263a8a89f1e1ae52f69acb7629f815b3acebf62af9',11,31,31),
('530c9dc7-c0fe-4de0-89a1-95e87adbc6f7'::uuid,'eee81a3b-88e0-46f7-9b7f-ef4550a33a58'::uuid,'grudge','Charts','dev/Early_Algebra/revisions/530c9dc7-c0fe-4de0-89a1-95e87adbc6f7/Oogie Grudge.chart','ab7a959c035e56e81a6bb751e6cac393a93f84746de42565590549a5f288eb3f','SidecarJsons','dev/Early_Algebra/revisions/530c9dc7-c0fe-4de0-89a1-95e87adbc6f7/Oogie Grudge.encounters.json','864c2d2f8501e09fd66cd637b39b038952bcd41dbfd44ddb1b972d4b8ab9e834',10,29,29);
do $check$
begin
 if (select count(*) from corrective_publication p join public.game_content_revisions r on r.revision=p.source_revision and r.song_asset_id=p.song_asset_id and r.activity_key='early-algebra' and r.status='ready') <> 8 then
  raise exception 'Expected exactly eight ready source revisions';
 end if;
 if (select count(*) from corrective_publication p join storage.objects c on c.bucket_id=p.chart_bucket and c.name=p.chart_path join storage.objects s on s.bucket_id=p.sidecar_bucket and s.name=p.sidecar_path where coalesce((c.metadata->>'size')::bigint,0)>0 and coalesce((s.metadata->>'size')::bigint,0)>0) <> 8 then
  raise exception 'Expected eight complete uploaded immutable pairs';
 end if;
end;
$check$;
insert into public.game_content_revisions (
 revision,song_chart_id,song_asset_id,activity_key,author_id,chart_bucket,chart_path,chart_sha256,
 sidecar_bucket,sidecar_path,sidecar_sha256,audio_bucket,audio_path,audio_sha256,
 authored_lesson_version,authored_mode,equation_count,encounter_count,target_count,status,
 publication_request_id,created_at
)
select p.revision,r.song_chart_id,r.song_asset_id,r.activity_key,r.author_id,p.chart_bucket,p.chart_path,p.chart_sha256,
 p.sidecar_bucket,p.sidecar_path,p.sidecar_sha256,r.audio_bucket,r.audio_path,r.audio_sha256,
 3,'authored',p.equation_count,p.encounter_count,p.target_count,'publishing',
 'corrective-paired-publication-20261011-' || p.revision::text,clock_timestamp()
from corrective_publication p join public.game_content_revisions r on r.revision=p.source_revision
on conflict (revision) do nothing;
update public.game_content_revisions r set status='ready',published_at=clock_timestamp()
from corrective_publication p where r.revision=p.revision and r.status='publishing';
do $verify$
begin
 if (select count(*) from corrective_publication p join public.game_content_revisions r on r.revision=p.revision and r.status='ready' and r.chart_path=p.chart_path and r.sidecar_path=p.sidecar_path and r.chart_sha256=p.chart_sha256 and r.sidecar_sha256=p.sidecar_sha256) <> 8 then
  raise exception 'Corrective publication identity verification failed';
 end if;
end;
$verify$;
update public."SongChart" c set "chartBucket"=r.chart_bucket,"chartPath"=r.chart_path,
 "sidecarBucket"=r.sidecar_bucket,"sidecarPath"=r.sidecar_path,"updatedAt"=clock_timestamp()
from public.game_content_revisions r join corrective_publication p on p.revision=r.revision
where c.id=r.song_chart_id and r.status='ready';
commit;
select song_asset_id,revision,status,equation_count,encounter_count,target_count
from public.game_content_revisions where publication_request_id like 'corrective-paired-publication-20261011-%'
order by song_asset_id;
