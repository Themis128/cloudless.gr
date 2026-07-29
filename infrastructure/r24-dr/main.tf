# R24: standby Lambda in us-west-2 (passive DR target)
#
# Deploys a minimal health Lambda that can serve as the Route 53 SECONDARY
# target once Global Tables replicas are live. Primary traffic stays on
# us-east-1 SST; this stack is warm-standby only.

data "aws_caller_identity" "current" {}

data "archive_file" "standby_zip" {
  type        = "zip"
  output_path = "${path.module}/standby-lambda.zip"
  source {
    content  = <<-JS
      exports.handler = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          role: "r24-standby",
          region: process.env.AWS_REGION || "us-west-2",
        }),
      });
    JS
    filename = "index.js"
  }
}

resource "aws_iam_role" "standby" {
  provider = aws.west
  name     = "${var.project}-r24-standby-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "standby_basic" {
  provider   = aws.west
  role       = aws_iam_role.standby.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "standby" {
  provider         = aws.west
  function_name    = "${var.project}-r24-standby"
  role             = aws_iam_role.standby.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.standby_zip.output_path
  source_code_hash = data.archive_file.standby_zip.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      SENTRY_ENVIRONMENT = "r24-standby"
      PRIMARY_REGION     = var.primary_region
    }
  }
}

resource "aws_lambda_function_url" "standby" {
  provider           = aws.west
  function_name      = aws_lambda_function.standby.function_name
  authorization_type = "NONE"
}

output "standby_function_url" {
  value = aws_lambda_function_url.standby.function_url
}

output "standby_function_arn" {
  value = aws_lambda_function.standby.arn
}
