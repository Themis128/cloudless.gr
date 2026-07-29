import { Heading, Text, Section, Row, Column } from "react-email";
import * as React from "react";
import BaseLayout from "./BaseLayout";

interface OrderConfirmationProps {
  orderId: string;
  total: string;
}

export default function OrderConfirmation({
  orderId = "cs_test_123",
  total = "€99.00",
}: OrderConfirmationProps) {
  return (
    <BaseLayout preview={`Order confirmed: ${total}`}>
      <Heading style={heading}>Order Confirmed</Heading>
      <Text style={paragraph}>Thanks for your purchase! Here are your order details:</Text>
      <Section style={table}>
        <Row>
          <Column style={labelCell}>Order ID</Column>
          <Column style={valueCell}>{orderId}</Column>
        </Row>
        <Row>
          <Column style={labelCell}>Total</Column>
          <Column style={{ ...valueCell, fontWeight: "bold" }}>{total}</Column>
        </Row>
      </Section>
      <Text style={paragraph}>
        If your order includes digital products, download links will be sent in a separate email
        shortly. If you ordered physical items, we will notify you when they ship.
      </Text>
    </BaseLayout>
  );
}

const heading = {
  color: "#0a7785",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 16px",
};

const paragraph = {
  color: "#0f1822",
  fontSize: "14px",
  lineHeight: "24px",
};

const table = {
  margin: "16px 0",
  borderCollapse: "collapse" as const,
};

const labelCell = {
  padding: "8px",
  borderBottom: "1px solid #dde3ec",
  color: "#5b6776",
  fontSize: "14px",
};

const valueCell = {
  padding: "8px",
  borderBottom: "1px solid #dde3ec",
  fontSize: "14px",
};
