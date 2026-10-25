--
-- PostgreSQL database dump
--

\restrict 3eXZmZQKNJprLoZe3jmKopXY12CwuG79M8XLoTQvSSJ3FHX5DaB9Lu9DwgoL2Uo

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: membership_removal_operations; Type: TABLE DATA; Schema: thermus_admin; Owner: -
--

COPY thermus_admin.membership_removal_operations (organization_id, operation_id, membership_id, revision, actor_authority, actor_subject, started_at, outcome) FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

\unrestrict 3eXZmZQKNJprLoZe3jmKopXY12CwuG79M8XLoTQvSSJ3FHX5DaB9Lu9DwgoL2Uo

