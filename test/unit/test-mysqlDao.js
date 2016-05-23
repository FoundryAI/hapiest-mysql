'use strict';

const Should = require('should');
const Mysql = require('mysql');
const _ = require('lodash');
const VO = require('hapiest-vo');

const MysqlDao = require('../../lib/mysqlDao');
const MysqlDaoArgsFactory = require('../../lib/mysqlDaoArgsFactory');
const MysqlServiceFactory = require('../../lib/mysqlServiceFactory');

class User extends VO {
    constructor(args) {
        super();
        this._addProperties(args);
    }

    get id() { return this.get('id'); }
    get firstName() { return this.get('firstName'); }
    get lastName() { return this.get('lastName'); }
    get email() { return this.get('email'); }
    get dateCreated() { return this.get('dateCreated'); }
}

const createUserFromDbRow = (dbRow) => {
    const userArgs = {};
    Object.keys(dbRow).forEach(columnName => {
        const camelCaseColumn = _.camelCase(columnName);
        userArgs[camelCaseColumn] = dbRow[columnName];
    });
    return new User(userArgs);
};

const LoggerFactory = require('hapiest-logger/lib/loggerFactory');
const LoggerConfigFactory = require('hapiest-logger/lib/loggerConfigFactory');
const loggerConfig = LoggerConfigFactory.createFromJsObj({enabled: true, consoleTransport: {enabled:true, level: 'info'}});
const logger = LoggerFactory.createLogger(loggerConfig);


// @TODO: moves this elsewhere perhaps
const writeConnectionConfig = {
    host: 'localhost',
    database: 'hapiestmysql',
    user: 'hapiestmysql',
    password: 'hapiestmysql',
    connectionLimit: 1
};
const mysqlService = MysqlServiceFactory.createFromObjWithOnePool(writeConnectionConfig, logger);

const mysqlDaoArgs = MysqlDaoArgsFactory.createFromJsObj({
    mysqlService: mysqlService,
    tableName: 'users',
    createVoFromDbRowFunction: createUserFromDbRow,
    logger: logger
});
const mysqlDao = new MysqlDao(mysqlDaoArgs);

function databaseSetup(done) {

    const queries = [
        'DROP TABLE IF EXISTS users',
        `
                CREATE TABLE IF NOT EXISTS users (
                    id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
                    first_name VARCHAR(100) NULL,
                    last_name VARCHAR(100) NULL,
                    email VARCHAR(255) NOT NULL,
                    date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `
    ];

    mysqlService.executeQueries(queries)
        .then(() => done(), (err) => done(err));
}

function databaseTeardown(done) {
    const queries = ['DROP TABLE IF EXISTS users'];
    mysqlService.executeQueries(queries)
        .then(() => done(), (err) => done(err));
}


describe('MysqlDao', function() {

    after(databaseTeardown);

    describe('create', function() {
        beforeEach(databaseSetup);

        it('Should create a single row in the users table', function() {
            return mysqlDao.create({firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'})
                .then(id => {
                    Should.exist(id);
                    id.should.be.a.Number();

                    const checkRowPromise = mysqlService.selectOne(`SELECT * FROM users WHERE email = 'john.doe@gmail.com'`)
                        .then(dbRow => {
                            Should.exist(dbRow);
                            dbRow.id.should.be.a.Number();
                            dbRow.first_name.should.eql('John');
                            dbRow.last_name.should.eql('Doe');
                            dbRow.email.should.eql('john.doe@gmail.com');
                            Should.exist(dbRow.date_created);
                        });
                    return Promise.all([checkRowPromise]);
                });
        });

    });

    describe('createBulk', function() {
        beforeEach(databaseSetup);

        it('Should create two row in the users table', function() {
            return mysqlDao.createBulk([
                {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
            ])
                .then((numRows) => {
                    Should.exist(numRows);
                    numRows.should.eql(2);

                    const checkRowPromise1 = mysqlService.selectOne(`SELECT * FROM users WHERE email = 'john.doe@gmail.com'`)
                        .then(dbRow => {
                            Should.exist(dbRow);
                            dbRow.id.should.be.a.Number();
                            dbRow.first_name.should.eql('John');
                            dbRow.last_name.should.eql('Doe');
                            dbRow.email.should.eql('john.doe@gmail.com');
                            Should.exist(dbRow.date_created);
                        });

                    const checkRowPromise2 = mysqlService.selectOne(`SELECT * FROM users WHERE email = 'jane.doe@gmail.com'`)
                        .then(dbRow => {
                            Should.exist(dbRow);
                            dbRow.id.should.be.a.Number();
                            dbRow.first_name.should.eql('Jane');
                            dbRow.last_name.should.eql('Doe');
                            dbRow.email.should.eql('jane.doe@gmail.com');
                            Should.exist(dbRow.date_created);
                        });

                    return Promise.all([checkRowPromise1, checkRowPromise2]);
                });
        });
    });

    describe('getOneById', function() {
        beforeEach(databaseSetup);

        it('Should fetch a single row by id', function() {
            let newId = null;
            return mysqlDao.create({firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'})
                .then(id => { newId = id})
                .then(() => {
                    const createPromise = mysqlDao.create({firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}); // Add this to make sure the ID lookup actually does something
                    return Promise.all([createPromise]);
                })
                .then(() => {
                    const checkRowPromise = mysqlDao.getOneById(newId)
                        .then(user => {
                            Should.exist(user);
                            user.should.be.an.instanceOf(User);
                            user.id.should.be.a.Number();
                            user.firstName.should.eql('John');
                            user.lastName.should.eql('Doe');
                            user.email.should.eql('john.doe@gmail.com');
                            Should.exist(user.dateCreated);
                        });
                    return Promise.all([checkRowPromise]);
                });
        });

    });

    describe('getOne', function() {
        beforeEach(databaseSetup);

        it('Should fetch a single row by email and first name', function() {
            let newId = null;
            return mysqlDao.create({firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'})
                .then(id => { newId = id})
                .then(() => {
                    const createPromise = mysqlDao.create({firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}); // Add this to make sure the ID lookup actually does something
                    return Promise.all([createPromise]);
                })
                .then(() => {
                    const checkRowPromise = mysqlDao.getOne({firstName: 'Jane', email: 'jane.doe@gmail.com'})
                        .then(user => {
                            Should.exist(user);
                            user.should.be.an.instanceOf(User);
                            user.id.should.be.a.Number();
                            user.firstName.should.eql('Jane');
                            user.lastName.should.eql('Doe');
                            user.email.should.eql('jane.doe@gmail.com');
                            Should.exist(user.dateCreated);
                        });
                    return Promise.all([checkRowPromise]);
                });
        });
    });

    describe('getAll', function() {
        beforeEach(databaseSetup);

        it('Should return two users', function() {
            return mysqlDao.createBulk([
                    {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                    {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
                ])
                .then((numRows) => {

                    const checkRowPromise1 = mysqlDao.getAll({lastName: 'Doe'})
                        .then(users => {
                            Should.exist(users);
                            users.should.be.an.Array();
                            users.length.should.eql(2);
                        });

                    return Promise.all([checkRowPromise1]);
                });
        });
    });

    describe('updateById', function() {
        beforeEach(databaseSetup);

        it('Should update Jane email address', function() {
            return mysqlDao.createBulk([
                    {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                    {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
                ])
                .then((numRows) => {
                    const getIdPromise = mysqlDao.getOne({email: 'jane.doe@gmail.com'}).then(user => user.id);
                    return Promise.all([getIdPromise]).then(results => results[0]);
                })
                .then(idToUpdate => {
                    const updatePromise = mysqlDao.updateById(idToUpdate, {firstName: 'joe', lastName: 'bob'});
                    return Promise.all([updatePromise]).then(results => results[0]);
                })
                .then(numRowsChanged => {
                    Should.exist(numRowsChanged);
                    numRowsChanged.should.eql(1);

                    const assertPromise = mysqlDao.getOne({email: 'jane.doe@gmail.com'})
                        .then(user => {
                            Should.exist(user);

                            user.firstName.should.eql('joe');
                            user.lastName.should.eql('bob');
                            user.email.should.eql('jane.doe@gmail.com');
                        });
                    return Promise.all([assertPromise]);
                });
        });
    });

    describe('updateOne', function() {
        beforeEach(databaseSetup);

        it('Should update John Doe user', function() {
            return mysqlDao.createBulk([
                    {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                    {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
                ])
                .then(() => {
                    const updatePromise = mysqlDao.updateOne({firstName: 'John'}, {firstName: 'joe', lastName: 'bob'});
                    return Promise.all([updatePromise]).then(results => results[0]);
                })
                .then(numRowsChanged => {
                    Should.exist(numRowsChanged);
                    numRowsChanged.should.eql(1);

                    const assertPromise = mysqlDao.getOne({email: 'john.doe@gmail.com'})
                        .then(user => {
                            Should.exist(user);

                            user.firstName.should.eql('joe');
                            user.lastName.should.eql('bob');
                            user.email.should.eql('john.doe@gmail.com');
                        });
                    return Promise.all([assertPromise]);
                });
        });
    });

    describe('deleteById', function() {
        beforeEach(databaseSetup);

        it('Should delete Jane Doe user', function() {
            return mysqlDao.createBulk([
                    {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                    {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
                ])
                .then((numRows) => {
                    const getIdPromise = mysqlDao.getOne({email: 'jane.doe@gmail.com'}).then(user => user.id);
                    return Promise.all([getIdPromise]).then(results => results[0]);
                })
                .then(idToDelete => {
                    const deletePromise = mysqlDao.deleteById(idToDelete);
                    return Promise.all([deletePromise]).then(results => results[0]);
                })
                .then(numRowsChanged => {
                    Should.exist(numRowsChanged);
                    numRowsChanged.should.eql(1);

                    const assertPromise = mysqlDao.getOne({email: 'jane.doe@gmail.com'})
                        .then(user => {
                            Should.not.exist(user);
                        });
                    return Promise.all([assertPromise]);
                });
        });
    });

    describe('deleteOne', function() {
        beforeEach(databaseSetup);

        it('Should delete John Doe user', function() {
            return mysqlDao.createBulk([
                    {firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com'},
                    {firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com'}
                ])
                .then(idToDelete => {
                    const deletePromise = mysqlDao.deleteOne({firstName: 'John'});
                    return Promise.all([deletePromise]).then(results => results[0]);
                })
                .then(numRowsChanged => {
                    Should.exist(numRowsChanged);
                    numRowsChanged.should.eql(1);

                    const assertPromise = mysqlDao.getOne({email: 'john.doe@gmail.com'})
                        .then(user => {
                            Should.not.exist(user);
                        });
                    return Promise.all([assertPromise]);
                });
        });
    });

});

