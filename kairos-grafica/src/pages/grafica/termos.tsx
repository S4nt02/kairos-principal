import { Helmet } from "react-helmet-async";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";

export default function Termos() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Helmet>
        <title>Termos de Uso | Kairós Gráfica</title>
        <meta
          name="description"
          content="Termos de uso da Gráfica Kairós. Leia os termos e condições do nosso serviço de impressão online."
        />
      </Helmet>
      <GraficaNavbar breadcrumbs={[{ label: "Termos de Uso" }]} />

      <div className="container mx-auto px-6 pt-12 pb-24 max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Termos de Uso</h1>
        <p className="text-muted-foreground">Última atualização: Março de 2026</p>

        <h2>1. Aceitação dos Termos</h2>
        <p>
          Ao utilizar os serviços da Kairós Gráfica, você concorda com estes termos de uso.
          Se não concordar com qualquer parte destes termos, não utilize nossos serviços.
        </p>

        <h2>2. Serviços Oferecidos</h2>
        <p>
          A Kairós Gráfica oferece serviços de impressão gráfica sob demanda, incluindo
          cartões de visita, flyers, banners, adesivos e outros materiais impressos.
          Os produtos são fabricados conforme as especificações selecionadas pelo cliente
          e os arquivos de arte fornecidos.
        </p>

        <h2>3. Arquivos de Arte</h2>
        <p>
          O cliente é responsável por enviar arquivos de arte em conformidade com as
          especificações técnicas indicadas em cada produto (formato, resolução, sangria, etc.).
          A Kairós Gráfica não se responsabiliza por erros de ortografia, cores ou layout
          presentes no arquivo enviado pelo cliente.
        </p>

        <h2>4. Preços e Pagamento</h2>
        <p>
          Os preços exibidos no site são válidos para o momento da compra. O pagamento
          é processado via MercadoPago. A produção só é iniciada após confirmação do
          pagamento.
        </p>

        <h2>5. Prazos de Produção e Entrega</h2>
        <p>
          Os prazos de produção são contados em dias úteis a partir da aprovação do
          pagamento e da arte. Os prazos de entrega são estimativas da transportadora
          e podem sofrer variações por motivos alheios à nossa vontade.
        </p>

        <h2>6. Cancelamentos e Reembolsos</h2>
        <p>
          Pedidos podem ser cancelados enquanto estiverem com status &quot;Pendente&quot; ou
          &quot;Confirmado&quot;. Após entrada em produção, não será possível cancelar.
          Reembolsos são processados pelo mesmo método de pagamento utilizado na compra,
          em até 10 dias úteis.
        </p>

        <h2>7. Defeitos e Reclamações</h2>
        <p>
          Em caso de defeito de fabricação, o cliente deve entrar em contato em até 7 dias
          corridos após o recebimento, apresentando fotos do material recebido.
          Após análise, a Kairós Gráfica poderá reenviar o material ou efetuar reembolso.
        </p>

        <h2>8. Propriedade Intelectual</h2>
        <p>
          O cliente garante que possui os direitos sobre os arquivos enviados para impressão.
          A Kairós Gráfica não se responsabiliza pelo uso indevido de marcas, imagens
          ou conteúdo protegido por direitos autorais.
        </p>

        <h2>9. Alterações nos Termos</h2>
        <p>
          A Kairós Gráfica reserva-se o direito de alterar estes termos a qualquer momento.
          Alterações entram em vigor imediatamente após publicação no site.
        </p>

        <h2>10. Contato</h2>
        <p>
          Para dúvidas ou reclamações, entre em contato pelo e-mail{" "}
          <a href="mailto:contato@kairosgrafica.com.br">contato@kairosgrafica.com.br</a>.
        </p>
      </div>

      <Footer />
    </div>
  );
}
