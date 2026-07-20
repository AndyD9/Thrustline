alter type public.dispatch_status add value if not exists 'preflight' after 'dispatched';
alter type public.dispatch_status add value if not exists 'boarding' after 'preflight';
alter type public.dispatch_status add value if not exists 'ready' after 'boarding';
