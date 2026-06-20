import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export default function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or contact us at tbaltzakis@cloudless.gr
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#fcfcfd",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 24px",
  maxWidth: "600px",
};

const hr = {
  borderColor: "#dde3ec",
  margin: "24px 0",
};

const footer = {
  color: "#5b6776",
  fontSize: "12px",
  lineHeight: "20px",
};
