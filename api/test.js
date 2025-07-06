export default function handler(request, response) {
  console.log("TEST ENDPOINT WAS HIT SUCCESSFULLY!");
  response.status(200).send("OK");
}
