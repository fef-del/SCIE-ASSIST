# SCIE Assist

Aplicação web que ajuda o técnico a determinar, segundo o regime SCIE português (DL n.º 220/2008):
a utilização-tipo (12), a categoria de risco (1.ª a 4.ª) e se basta a **ficha de segurança** (1.ª categoria) ou é obrigatório **projeto de especialidade** (2.ª a 4.ª). Para as UT XI e XII calcula a carga de incêndio (Despacho n.º 2074/2009).

**Princípio:** as regras estão no código (`public/data/regras.json` + `public/js/classificar.js`). A IA só lê plantas e *sugere* valores; o técnico confirma.

## Estrutura
- `public/` — a aplicação (HTML, CSS, JavaScript, tabelas em `data/`).
- `api/ler-planta.js` — função que chama a IA (Gemini). A chave fica só no servidor.
- `test/` — testes das regras e do cálculo (`npm test`).
- `tools/extrair_quadros.py` — como os Quadros I e II do Despacho foram extraídos do PDF.

## Publicar (GitHub + Vercel)
1. No GitHub: *New repository* → `scie-assist` → *uploading an existing file* → arraste **o conteúdo** desta pasta (não o zip) → *Commit changes*.
2. Na Vercel: *Add New → Project* → escolha o repositório → *Deploy* (sem alterar nada; o `vercel.json` já indica a pasta `public`).
3. Para ativar a leitura de plantas: em https://aistudio.google.com/apikey crie uma chave gratuita. Na Vercel: *Project → Settings → Environment Variables* → nome `GEMINI_API_KEY`, valor = a chave → *Redeploy*. **Nunca partilhe a chave em conversas nem a ponha no código.**
4. Opcional: `GEMINI_MODEL` para mudar de modelo (por omissão `gemini-2.5-flash`; confirme no AI Studio o modelo gratuito disponível).

## Estado da verificação das tabelas
Todas as utilizações-tipo estão «por verificar» até serem conferidas com o Diário da República; a XI está «com divergência» (carga de incêndio: Anexo I da Lei 123/2019 vs. republicação). Quando conferir uma tabela, mude `"verificacao"` para `"verificada"` em `public/data/regras.json`.
Os Quadros I e II do Despacho (`public/data/quadro1.json`, `quadro2.json`) foram extraídos automaticamente do PDF: confira os valores que usar.

## Executar localmente
`npm test` corre os testes. Para ver a app: `cd public && python3 -m http.server 8000` e abra http://localhost:8000.
