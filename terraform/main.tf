provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "example" {
  name     = "cloudless-gr-resource-group"
  location = "East US"
}

resource "azurerm_app_service_plan" "example" {
  name                = "cloudless-gr-app-service-plan"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location
  sku_name              = "Y1" # Y1 is free tier for non-production apps
}

resource "azurerm_app_service" "example" {
  name                = "cloudless-gr-web-app"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location
  app_service_plan_id   = azurerm_app_service_plan.example.id

  site_config {
    application_stack_version = 15 # For Node.js 18.x
    always_on               = true
  }
}