import { Helmet } from "react-helmet-async";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Helmet>
        <title>Política de Privacidade | Kairós Gráfica</title>
        <meta
          name="description"
          content="Política de privacidade da Gráfica Kairós. Saiba como tratamos seus dados pessoais em conformidade com a LGPD."
        />
      </Helmet>
      <GraficaNavbar breadcrumbs={[{ label: "Privacidade" }]} />

      <div className="container mx-auto px-6 pt-12 pb-24 max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Política de Privacidade</h1>
        <p className="text-muted-foreground">Última atualização: Março de 2026</p>

        <p>
          A Kairós Gráfica está comprometida com a proteção dos dados pessoais dos seus
          clientes, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>

        <h2>1. Dados Coletados</h2>
        <p>Coletamos os seguintes dados pessoais:</p>
        <ul>
          <li><strong>Cadastro:</strong> nome, e-mail, telefone e senha (armazenada de forma criptografada).</li>
          <li><strong>Endereço:</strong> CEP, rua, número, complemento, bairro, cidade e estado para entrega.</li>
          <li><strong>Pagamento:</strong> os dados de pagamento são processados diretamente pelo MercadoPago. Não armazenamos dados de cartão de crédito.</li>
          <li><strong>Navegação:</strong> podemos coletar dados de uso do site (páginas visitadas, tempo de permanência) via Google Analytics para melhoria do serviço.</li>
        </ul>

        <h2>2. Finalidade do Tratamento</h2>
        <p>Seus dados são utilizados para:</p>
        <ul>
          <li>Processar e entregar seus pedidos.</li>
          <li>Comunicar atualizações sobre status de pedidos.</li>
          <li>Enviar comunicações de marketing (apenas com seu consentimento).</li>
          <li>Melhorar nossos serviços e experiência do site.</li>
          <li>Cumprir obrigações legais e fiscais.</li>
        </ul>

        <h2>3. Compartilhamento de Dados</h2>
        <p>
          Seus dados podem ser compartilhados com:
        </p>
        <ul>
          <li><strong>MercadoPago:</strong> para processamento de pagamentos.</li>
          <li><strong>Transportadoras (Melhor Envio):</strong> nome, endereço e telefone para envio dos pedidos.</li>
          <li><strong>Serviços de e-mail:</strong> para envio de notificações transacionais.</li>
        </ul>
        <p>
          Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de
          marketing sem seu consentimento explícito.
        </p>

        <h2>4. Armazenamento e Segurança</h2>
        <p>
          Seus dados são armazenados em servidores seguros com criptografia.
          Senhas são armazenadas usando hash criptográfico (bcrypt) e nunca são
          armazenadas em texto plano. Utilizamos HTTPS em todas as comunicações.
        </p>

        <h2>5. Seus Direitos (LGPD)</h2>
        <p>Você tem direito a:</p>
        <ul>
          <li>Acessar seus dados pessoais.</li>
          <li>Corrigir dados incompletos ou desatualizados.</li>
          <li>Solicitar a exclusão de seus dados pessoais.</li>
          <li>Revogar o consentimento para comunicações de marketing.</li>
          <li>Solicitar a portabilidade dos seus dados.</li>
        </ul>

        <h2>6. Cookies</h2>
        <p>
          Utilizamos cookies essenciais para o funcionamento do site (sessão, autenticação)
          e cookies de análise (Google Analytics). Você pode desabilitar cookies de análise
          nas configurações do seu navegador.
        </p>

        <h2>7. Retenção de Dados</h2>
        <p>
          Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas
          nesta política e obrigações legais. Dados de pedidos são mantidos por 5 anos
          para fins fiscais.
        </p>

        <h2>8. Contato do Encarregado (DPO)</h2>
        <p>
          Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados,
          entre em contato pelo e-mail{" "}
          <a href="mailto:privacidade@kairosgrafica.com.br">privacidade@kairosgrafica.com.br</a>.
        </p>

        <h2>9. Alterações</h2>
        <p>
          Esta política pode ser atualizada periodicamente. Alterações significativas
          serão comunicadas por e-mail ou aviso no site.
        </p>
      </div>

      <Footer />
    </div>
  );
}
