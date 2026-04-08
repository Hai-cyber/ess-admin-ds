export default {
  async fetch(_request) {
    return Response.json({
      worker: 'sms',
      status: 'scaffolded',
      message: 'SMS worker scaffold.'
    });
  }
};
