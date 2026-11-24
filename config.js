// Configuracao PUBLICA do aplicativo do celular. E o unico arquivo que sabe onde fica a nuvem.
//
// Enquanto os dois valores abaixo forem os marcadores "__SUPABASE_URL__" e "__SUPABASE_CHAVE__", o aplicativo nao tenta falar com
// ninguem: mostra uma tela dizendo que falta preencher este arquivo.
//
// SUPABASE_URL: o endereco do projeto, no formato https://<projeto>.supabase.co (sem barra no fim).
// SUPABASE_CHAVE_PUBLICA: a chave "publishable" (ou "anon") do projeto. Ela foi feita para ficar dentro do aplicativo e, sozinha, nao
// abre dado nenhum: quem protege os dados e o login (e-mail, senha e codigo do autenticador) mais a regra de acesso por linha do banco.
// A chave de servico (service_role ou secret) NUNCA pode aparecer aqui.
//
// Ao preencher, troque tambem o connect-src da politica de seguranca (meta Content-Security-Policy) em index.html para o mesmo
// endereco. Se os dois nao baterem, o aplicativo avisa na tela em vez de fingir que esta sem internet.
export const SUPABASE_URL = "https://ptexfxslxfmiuifsulyr.supabase.co";
export const SUPABASE_CHAVE_PUBLICA = "sb_publishable_-MN8p_QQ4exlzp9nvzBKXQ_X4-JS9vm";
