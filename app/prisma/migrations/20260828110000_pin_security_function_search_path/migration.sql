-- Pin the search_path for SECURITY DEFINER trigger functions.
-- Keeping it empty prevents callers from shadowing unqualified objects.
ALTER FUNCTION public.pagos_online_proteger_cuenta_connect()
  SET search_path = '';

ALTER FUNCTION public.intentos_pago_proteger_autorizacion()
  SET search_path = '';
