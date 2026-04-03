import { Helmet } from "react-helmet-async";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Quais são os prazos de entrega?",
    answer:
      "O prazo de produção varia de 3 a 7 dias úteis, dependendo do produto e da quantidade. Após a produção, o envio é feito via transportadora, com prazo estimado no momento da compra conforme o CEP de destino.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "Aceitamos pagamento via MercadoPago, que inclui: cartão de crédito (em até 12x), boleto bancário, Pix e saldo em conta MercadoPago.",
  },
  {
    question: "Como envio meu arquivo de arte?",
    answer:
      "Você pode enviar seu arquivo durante o checkout ou após finalizar o pedido, na página do pedido. Aceitamos PDF, JPG, PNG, TIFF, AI e EPS. Recomendamos enviar em PDF com sangria de 3mm e resolução mínima de 300dpi.",
  },
  {
    question: "Posso cancelar meu pedido?",
    answer:
      "Sim, pedidos com status \"Pendente\" ou \"Confirmado\" podem ser cancelados na página do pedido em sua conta. Após entrar em produção, não é possível cancelar. Se o pagamento já foi realizado, o reembolso será feito automaticamente.",
  },
  {
    question: "Qual a política de troca e devolução?",
    answer:
      "Caso o produto apresente defeito de fabricação, entre em contato pelo e-mail contato@kairosgrafica.com.br em até 7 dias após o recebimento. Enviaremos nova remessa ou realizaremos o reembolso. Não aceitamos trocas por insatisfação com a arte enviada pelo cliente.",
  },
  {
    question: "Vocês fazem a criação da arte?",
    answer:
      "No momento, trabalhamos apenas com arquivos prontos enviados pelo cliente. Recomendamos contratar um designer gráfico para criar sua arte conforme as especificações do produto.",
  },
  {
    question: "Qual a quantidade mínima de pedido?",
    answer:
      "A quantidade mínima varia por produto. Na página de cada produto, você verá as opções de quantidade disponíveis. Em geral, a quantidade mínima é de 100 unidades.",
  },
  {
    question: "Como acompanho meu pedido?",
    answer:
      "Após o envio, você receberá o código de rastreamento por e-mail e poderá acompanhar o status do pedido na página \"Minha Conta\".",
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Helmet>
        <title>Perguntas Frequentes | Kairós Gráfica</title>
        <meta
          name="description"
          content="Dúvidas sobre prazos, pagamento, envio de arte e mais. Confira as perguntas frequentes da Gráfica Kairós."
        />
      </Helmet>
      <GraficaNavbar breadcrumbs={[{ label: "FAQ" }]} />

      <div className="container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-2">
          Perguntas Frequentes
        </h1>
        <p className="text-muted-foreground mb-10">
          Encontre respostas para as dúvidas mais comuns sobre nossos serviços.
        </p>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
              <AccordionTrigger className="text-left font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <Footer />
    </div>
  );
}
