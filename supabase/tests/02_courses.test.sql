begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.course_categories (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Infra');
insert into public.courses (id, title, category_id, estimated_hours)
values ('cccccccc-0000-0000-0000-000000000001', 'Docker avançado', 'aaaaaaaa-0000-0000-0000-000000000001', 12);

select is((select status::text from public.courses), 'backlog', 'new course starts in backlog');

update public.courses set status = 'in_progress';
select is((select started_on from public.courses), current_date, 'in_progress sets started_on');

update public.courses set status = 'done';
select results_eq(
  $$ select progress_pct::int, finished_on from public.courses $$,
  $$ values (100, current_date) $$,
  'done sets progress 100 and finished_on'
);

update public.courses set status = 'paused';
select is((select finished_on from public.courses), null, 'leaving done clears finished_on');

select throws_ok(
  $$ insert into public.courses (title, url) values ('x', 'javascript:alert(1)') $$,
  '23514',
  null,
  'non http url rejected'
);

select throws_ok(
  $$ insert into public.course_categories (name) values ('Infra') $$,
  '23505',
  null,
  'category name unique per user'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.courses), 0, 'B does not see A courses');
select is((select count(*)::int from public.course_categories), 0, 'B does not see A categories');

insert into public.course_categories (name) values ('Infra');
select is((select count(*)::int from public.course_categories), 1, 'B can reuse a category name');

select throws_ok(
  $$ insert into public.courses (title, category_id) values ('spoof', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23503',
  null,
  'B cannot attach a course to A category'
);

select * from finish();

rollback;
