# =============================================================================
# Terraform Outputs
# =============================================================================

output "api_gateway_url" {
  description = "API Gateway base URL with stage (use this in frontend config.js)"
  value       = "${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}"
}

output "api_gateway_base_url" {
  description = "API Gateway base URL without stage"
  value       = aws_apigatewayv2_api.chatbot.api_endpoint
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.chat_messages.name
}

output "s3_images_bucket" {
  description = "S3 bucket for images"
  value       = aws_s3_bucket.images.id
}

output "s3_frontend_bucket" {
  description = "S3 bucket for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_website_url" {
  description = "Frontend website URL"
  value       = "http://${aws_s3_bucket.frontend.bucket}.s3-website-${var.aws_region}.amazonaws.com"
}

output "lambda_functions" {
  description = "Deployed Lambda function names"
  value = {
    chat_handler      = aws_lambda_function.chat_handler.function_name
    image_generator   = aws_lambda_function.image_generator.function_name
    video_generator   = aws_lambda_function.video_generator.function_name
    process_document  = aws_lambda_function.process_document.function_name
    get_history       = aws_lambda_function.get_history.function_name
    function_call     = aws_lambda_function.function_call.function_name
  }
}

output "deployment_summary" {
  description = "Quick deployment summary"
  value = <<-EOT

  ╔════════════════════════════════════════════════════════════════╗
  ║              🚀 DEPLOYMENT SUCCESSFUL! 🎉                      ║
  ╚════════════════════════════════════════════════════════════════╝

  📝 Next Steps:

  1️⃣  Update Frontend Configuration:
     File: frontend/js/config.js
     Set:  API_BASE_URL = '${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}'

  2️⃣  Deploy Frontend to S3:
     aws s3 sync frontend/ s3://${aws_s3_bucket.frontend.id}

  3️⃣  Open Your Chatbot:
     URL: http://${aws_s3_bucket.frontend.bucket}.s3-website-${var.aws_region}.amazonaws.com

  ═══════════════════════════════════════════════════════════════

  📊 Resources Created:

  ✅ API Gateway:    ${aws_apigatewayv2_api.chatbot.name}
  ✅ DynamoDB Table: ${aws_dynamodb_table.chat_messages.name}
  ✅ S3 Images:      ${aws_s3_bucket.images.id}
  ✅ S3 Frontend:    ${aws_s3_bucket.frontend.id}
  ✅ Lambda Count:   6 functions

  ═══════════════════════════════════════════════════════════════

  🔗 API Endpoints:

  POST   ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/chat
  POST   ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/generate-image
  POST   ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/generate-video
  POST   ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/process-document
  POST   ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/function-call
  GET    ${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}/history/{sessionId}

  ═══════════════════════════════════════════════════════════════

  💡 Useful Commands:

  View logs:     aws logs tail /aws/lambda/${aws_lambda_function.chat_handler.function_name} --follow
  Test API:      curl ${aws_apigatewayv2_api.chatbot.api_endpoint}/chat
  Upload frontend: ./deploy-frontend.sh

  ╔════════════════════════════════════════════════════════════════╗
  ║                   Happy Chatting! 🤖                           ║
  ╚════════════════════════════════════════════════════════════════╝

  EOT
}
