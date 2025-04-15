import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  StdioServerTransport 
} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import z from "zod";

const server = new Server({
  name: "cocktail-api-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

const getCocktailSchema = z.object({
  name: z.string().describe("Cocktail name to search for")
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_cocktail",
        description: "Search for cocktail recipes by name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Cocktail name to search for"
            }
          },
          required: ["name"]
        }
      }
    ]
  };
});

function formatCocktail(drink: any) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const ingredient = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`];

    if (ingredient) {
      ingredients.push(`${measure ? measure.trim() : ''} ${ingredient}`);
    }
  }

  return `
🍸 ${drink.strDrink} 🍸
-----------------
Category: ${drink.strCategory}
Glass: ${drink.strGlass}
Alcoholic: ${drink.strAlcoholic}

Ingredients:
${ingredients.map(i => `• ${i.trim()}`).join('\n')}

Instructions:
${drink.strInstructions}
  `.trim();
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_cocktail") {
    try {

      const args = getCocktailSchema.parse(request.params.arguments);

      const url = `
       https://www.thecocktaildb.com/api/json/v1/1/search.php?
       s=${encodeURIComponent(args.name)}
      `;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CocktailDB API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.drinks) {
        return {
          content: [
            {
              type: "text",
              text: `No cocktails found matching "${args.name}". Try a different search term.`
            }
          ]
        };
      }

      const cocktailRecipes = data.drinks.map(formatCocktail);


      const result = `
        Found ${data.drinks.length} cocktail(s) matching 
        "${args.name}":\n\n${cocktailRecipes.join('\n\n')}
      `;

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      console.error("Error in get_cocktail tool:", error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error searching for cocktail: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }


  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Unknown tool: ${request.params.name}`
      }
    ]
  };
});


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Cocktail API server running on stdio");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
