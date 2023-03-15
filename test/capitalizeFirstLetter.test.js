const { capitalizeFirstLetter } = require('../lib/capitalizeFirstLetter');
const { expect } = require('chai');


describe('capitalizeFirstLetter.js', function() {
  it('should capitalize first letter of a valid string', function() {
    const mockString = 'some string';
    const expectedResponseMock = 'Some string';

    const value = capitalizeFirstLetter(mockString);
    expect(value).to.be.equal(expectedResponseMock);
  });

  it('should return parameter if non-string param is passed', function() {
    const value = capitalizeFirstLetter(34);
    expect(value).to.be.equal(34);
  });

  it('should return an empty string if invalid string passed', function() {
    const value = capitalizeFirstLetter('');
    expect(value).to.be.equal('');
  });
});
